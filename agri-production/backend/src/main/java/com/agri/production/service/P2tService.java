package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inventory;
import com.agri.production.mapper.InventoryMapper;
import com.agri.production.entity.P2tDiffTicket;
import com.agri.production.entity.P2tOffer;
import com.agri.production.entity.P2tSubscription;
import com.agri.production.entity.P2tVarietyMap;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.P2tDiffTicketMapper;
import com.agri.production.mapper.P2tOfferMapper;
import com.agri.production.mapper.P2tSubscriptionMapper;
import com.agri.production.mapper.P2tVarietyMapMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 产销对接（生产侧）服务。
 *
 * <p><b>领域边界</b>：本服务只处理「可供事实」——品种→品类映射、供给意向、认购回写、差异工单。
 * 商品、价格、订单、促销全部归交易撮合；生产端不建第二套商品/库存/订单/价格。</p>
 *
 * <p><b>三方口径</b>：供给量（说了能卖多少）· 成交量（卖出去多少，来自交易端回写）·
 * 入仓量（仓储管理入库结果）。本服务聚合供给与认购，发布上限按生产分仓有效库存扣除供给占用计算。</p>
 */
@Slf4j
@Service
public class P2tService {

    /** 未结案的供给状态（计入批次已发布量） */
    private static final List<String> OPEN_TRADE_STATUS = List.of("PENDING", "LISTED", "SOLD");

    private final P2tVarietyMapMapper varietyMapper;
    private final P2tOfferMapper offerMapper;
    private final P2tSubscriptionMapper subscriptionMapper;
    private final P2tDiffTicketMapper diffMapper;
    @org.springframework.beans.factory.annotation.Autowired
    private GradeReviewService gradeReviewService;
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.production.integration.TradeLogisticsClient diffEvidenceClient;
    private final HarvestBatchMapper harvestBatchMapper;
    private final InventoryMapper inventoryMapper;

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.production.integration.TradeCategoryClient tradeCategoryClient;

    public P2tService(P2tVarietyMapMapper varietyMapper,
                      P2tOfferMapper offerMapper,
                      P2tSubscriptionMapper subscriptionMapper,
                      P2tDiffTicketMapper diffMapper,
                      HarvestBatchMapper harvestBatchMapper, InventoryMapper inventoryMapper) {
        this.varietyMapper = varietyMapper;
        this.offerMapper = offerMapper;
        this.subscriptionMapper = subscriptionMapper;
        this.diffMapper = diffMapper;
        this.harvestBatchMapper = harvestBatchMapper;
        this.inventoryMapper = inventoryMapper;
    }

    /* ==================== 品种对接表 ==================== */

    public PageResult<P2tVarietyMap> pageVarieties(int pageNum, int pageSize, String keyword, Integer status,
                                                   String tenantId) {
        LambdaQueryWrapper<P2tVarietyMap> w = new LambdaQueryWrapper<P2tVarietyMap>()
                .eq(P2tVarietyMap::getTenantId, tenantId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(P2tVarietyMap::getCropName, kw)
                    .or().like(P2tVarietyMap::getVarietyName, kw)
                    .or().like(P2tVarietyMap::getCategoryCode, kw)
                    .or().like(P2tVarietyMap::getCategoryName, kw));
        }
        if (status != null) {
            w.eq(P2tVarietyMap::getStatus, status);
        }
        w.orderByDesc(P2tVarietyMap::getUpdateTime).orderByDesc(P2tVarietyMap::getId);
        Page<P2tVarietyMap> page = varietyMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        return PageResult.of(page.getRecords(), page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tVarietyMap saveVariety(P2tVarietyMap payload, String tenantId) {
        if (payload == null || isBlank(payload.getCropName())) {
            throw new BusinessException(400, "生产品种不能为空");
        }
        if (isBlank(payload.getCategoryCode())) {
            throw new BusinessException(400, "交易品类码不能为空");
        }
        if (isBlank(tenantId)) throw new BusinessException(400, "缺少当前经营主体");
        if (payload.getId() != null) requireVariety(payload.getId(), tenantId);
        com.agri.production.integration.TradeCategoryClient.Category category =
                tradeCategoryClient.requireEnabled(payload.getCategoryCode());
        payload.setCategoryCode(category.code());
        payload.setCategoryName(category.name());
        payload.setTenantId(tenantId);
        payload.setStatus(payload.getStatus() == null ? 1 : payload.getStatus());
        payload.setVersion(isBlank(payload.getVersion()) ? "MAP-2026-V1" : payload.getVersion().trim());
        payload.setConversionRate(payload.getConversionRate() == null
                ? BigDecimal.ONE : payload.getConversionRate());
        LocalDateTime now = LocalDateTime.now();
        if (payload.getId() == null) {
            payload.setCreateTime(now);
            payload.setUpdateTime(now);
            payload.setDeleted(0);
            varietyMapper.insert(payload);
        } else {
            P2tVarietyMap exists = requireVariety(payload.getId(), tenantId);
            payload.setTenantId(exists.getTenantId());
            payload.setUpdateTime(now);
            payload.setDeleted(0);
            varietyMapper.updateById(payload);
        }
        return varietyMapper.selectById(payload.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteVariety(Long id, String tenantId) {
        requireVariety(id, tenantId);
        varietyMapper.deleteById(id);
    }

    private P2tVarietyMap requireVariety(Long id, String tenantId) {
        P2tVarietyMap row = varietyMapper.selectById(id);
        if (row == null || !Objects.equals(row.getTenantId(), tenantId)) {
            throw new BusinessException(404, "品种映射不存在");
        }
        return row;
    }

    /** 按作物查找生效中的映射（一个作物可能映射多个品类，发布供给时必须指定品类） */
    public List<P2tVarietyMap> mapsOfCrop(Long cropId, String cropName, String tenantId) {
        LambdaQueryWrapper<P2tVarietyMap> w = new LambdaQueryWrapper<P2tVarietyMap>()
                .eq(P2tVarietyMap::getTenantId, tenantId)
                .eq(P2tVarietyMap::getStatus, 1);
        if (cropId != null) {
            w.and(q -> q.eq(P2tVarietyMap::getCropId, cropId)
                    .or(cropName != null, x -> x.eq(P2tVarietyMap::getCropName, cropName)));
        } else if (cropName != null) {
            w.eq(P2tVarietyMap::getCropName, cropName);
        }
        return varietyMapper.selectList(w);
    }

    /* ==================== 采收批次与可售量 ==================== */

    public PageResult<Map<String, Object>> pageBatches(int pageNum, int pageSize, String keyword, String tenantId) {
        LambdaQueryWrapper<HarvestBatch> w = new LambdaQueryWrapper<HarvestBatch>()
                .eq(HarvestBatch::getTenantId, tenantId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(HarvestBatch::getBatchNo, kw)
                    .or().like(HarvestBatch::getCropName, kw)
                    .or().like(HarvestBatch::getFarmName, kw));
        }
        w.orderByDesc(HarvestBatch::getHarvestDate).orderByDesc(HarvestBatch::getBatchId);
        Page<HarvestBatch> page = harvestBatchMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        List<Map<String, Object>> rows = page.getRecords().stream()
                .map(batch -> batchRow(batch, tenantId))
                .collect(Collectors.toList());
        return PageResult.of(rows, page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    /** 某批次的产销口径汇总（可上市量 / 已发布 / 已认购 / 是否可发布） */
    private Map<String, Object> batchRow(HarvestBatch batch, String tenantId) {
        List<P2tOffer> offers = batchOffers(batch.getBatchId(), tenantId);
        BigDecimal published = offers.stream().map(this::occupiedQty).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal reserved = offers.stream().map(o -> nz(o.getReservedQty())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal quantity = nz(batch.getQuantity());
        StockSummary stock = stockSummary(batch, tenantId);
        BigDecimal publishable = stock.available().subtract(published).max(BigDecimal.ZERO);
        List<P2tVarietyMap> maps = mapsOfCrop(batch.getCropId(), batch.getCropName(), tenantId);
        boolean mapped = !maps.isEmpty();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("batchId", batch.getBatchId());
        row.put("batchNo", batch.getBatchNo());
        row.put("cropId", batch.getCropId());
        row.put("cropName", batch.getCropName());
        row.put("cropVariety", batch.getCropVariety());
        row.put("farmId", batch.getFarmId());
        row.put("farmName", batch.getFarmName());
        row.put("plotName", batch.getPlotName());
        row.put("harvestDate", batch.getHarvestDate());
        row.put("quantity", quantity);
        row.put("unit", isBlank(batch.getUnit()) ? "kg" : batch.getUnit());
        row.put("grade", batch.getGrade());
        row.put("inspectionNo", batch.getInspectionNo());
        row.put("qualityJudged", !isBlank(batch.getInspectionNo()));
        row.put("stockQty", stock.current());
        row.put("frozenQty", stock.frozen());
        row.put("unusableQty", stock.unusable());
        row.put("availableStockQty", stock.available());
        row.put("stockShortfallQty", published.subtract(stock.available()).max(BigDecimal.ZERO));
        row.put("stockUnitMismatch", stock.unitMismatch());
        row.put("publishedQty", published);
        row.put("reservedQty", reserved);
        row.put("publishableQty", publishable);
        row.put("mapped", mapped);
        row.put("categoryCodes", maps.stream().map(P2tVarietyMap::getCategoryCode).distinct().toList());
        // 五项前置校验里能自动判定的三项；质检/溯源缺失按"未判定"如实展示，不编造
        row.put("publishable", mapped && publishable.signum() > 0);
        return row;
    }

    private List<P2tOffer> batchOffers(Long batchId, String tenantId) {
        return offerMapper.selectList(new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId).eq(P2tOffer::getBatchId, batchId)
                .last(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive() ? "FOR UPDATE" : ""));
    }

    private BigDecimal occupiedQty(P2tOffer offer) {
        BigDecimal reserved = nz(offer.getReservedQty()).max(BigDecimal.ZERO);
        return OPEN_TRADE_STATUS.contains(offer.getTradeStatus()) && !"REJECTED".equals(offer.getAuditStatus())
                ? nz(offer.getAvailableQty()).max(reserved) : reserved;
    }

    private record StockSummary(BigDecimal current, BigDecimal frozen, BigDecimal unusable,
                                BigDecimal available, boolean unitMismatch) {}

    private StockSummary stockSummary(HarvestBatch batch, String tenantId) {
        BigDecimal current = BigDecimal.ZERO, frozen = BigDecimal.ZERO, unusable = BigDecimal.ZERO;
        boolean mismatch = false;
        String unit = isBlank(batch.getUnit()) ? "kg" : batch.getUnit().trim();
        for (Inventory inv : inventoryMapper.selectList(new LambdaQueryWrapper<Inventory>()
                .eq(Inventory::getTenantId, tenantId).eq(Inventory::getBatchId, batch.getBatchId())
                .last(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive() ? "FOR UPDATE" : ""))) {
            BigDecimal qty = nz(inv.getCurrentQty()).max(BigDecimal.ZERO);
            if (!unit.equals(inv.getUnit() == null ? "" : inv.getUnit().trim())) {
                if (qty.signum() > 0) mismatch = true;
                continue;
            }
            current = current.add(qty);
            BigDecimal locked = Integer.valueOf(1).equals(inv.getFrozen()) ? qty
                    : nz(inv.getFrozenQty()).max(BigDecimal.ZERO).min(qty);
            frozen = frozen.add(locked);
            if (inv.getExpireDate() != null && inv.getExpireDate().isBefore(LocalDate.now()))
                unusable = unusable.add(qty.subtract(locked));
        }
        BigDecimal available = mismatch ? BigDecimal.ZERO : current.subtract(frozen).subtract(unusable).max(BigDecimal.ZERO);
        return new StockSummary(current, frozen, unusable, available, mismatch);
    }

    private void assertStockCapacity(HarvestBatch batch, String tenantId, Long excludingOfferId, BigDecimal requested) {
        if (batch == null) throw new BusinessException(404, "采收批次不存在或不属于当前主体");
        StockSummary stock = stockSummary(batch, tenantId);
        if (stock.unitMismatch()) throw new BusinessException(400, "库存单位与采收批次不一致，请先核对库存单位");
        BigDecimal occupied = batchOffers(batch.getBatchId(), tenantId).stream()
                .filter(o -> excludingOfferId == null || !Objects.equals(o.getId(), excludingOfferId))
                .map(this::occupiedQty).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal limit = stock.available().subtract(occupied).max(BigDecimal.ZERO);
        if (requested.compareTo(limit) > 0) throw new BusinessException(400,
                "现货可用库存不足：扣除冻结、过期及其他供给占用后最多可供 " + limit.stripTrailingZeros().toPlainString()
                        + "；请入库、解冻或调整供给，已认购未核销数量仍保留占用");
    }

    /* ==================== 供给意向 ==================== */

    public PageResult<P2tOffer> pageOffers(int pageNum, int pageSize, String keyword, String auditStatus,
                                           String tradeStatus, String tenantId) {
        return pageOffers(pageNum, pageSize, keyword, auditStatus, tradeStatus, null, tenantId);
    }

    public PageResult<P2tOffer> pageOffers(int pageNum, int pageSize, String keyword, String auditStatus,
                                           String tradeStatus, Long batchId, String tenantId) {
        if (batchId != null && batchId <= 0) throw new BusinessException("采收批次参数无效");
        LambdaQueryWrapper<P2tOffer> w = new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId);
        if (batchId != null) w.eq(P2tOffer::getBatchId, batchId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(P2tOffer::getOfferNo, kw)
                    .or().like(P2tOffer::getCropName, kw)
                    .or().like(P2tOffer::getBatchNo, kw)
                    .or().like(P2tOffer::getCategoryName, kw));
        }
        if (!isBlank(auditStatus)) {
            w.eq(P2tOffer::getAuditStatus, auditStatus.trim().toUpperCase());
        }
        if (!isBlank(tradeStatus)) {
            w.eq(P2tOffer::getTradeStatus, tradeStatus.trim().toUpperCase());
        }
        w.orderByDesc(P2tOffer::getCreateTime).orderByDesc(P2tOffer::getId);
        Page<P2tOffer> page = offerMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        return PageResult.of(page.getRecords(), page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    public P2tOffer findOffer(String offerNo, String tenantId) {
        LambdaQueryWrapper<P2tOffer> w = new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getOfferNo, offerNo);
        // tenantId 为空表示平台级服务通道（交易运营端跨主体查询），不加租户过滤
        if (tenantId != null) {
            w.eq(P2tOffer::getTenantId, tenantId);
        }
        P2tOffer offer = offerMapper.selectOne(w.last("LIMIT 1"));
        if (offer == null) {
            throw new BusinessException(404, "供给单不存在：" + offerNo);
        }
        return offer;
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tOffer createOffer(Map<String, Object> payload, String tenantId) {
        Long batchId = toLong(payload.get("batchId"));
        if (batchId == null) {
            throw new BusinessException(400, "请选择采收批次");
        }
        HarvestBatch batch = harvestBatchMapper.lockOwned(batchId, tenantId);
        if (batch == null || !Objects.equals(batch.getTenantId(), tenantId)) {
            throw new BusinessException(404, "采收批次不存在或不属于当前主体");
        }

        BigDecimal qty = toDecimal(payload.get("availableQty"));
        if (qty == null || qty.signum() <= 0) {
            throw new BusinessException(400, "可供量必须大于 0");
        }
        String categoryCode = str(payload.get("categoryCode"));
        List<P2tVarietyMap> maps = mapsOfCrop(batch.getCropId(), batch.getCropName(), tenantId);
        if (maps.isEmpty()) {
            throw new BusinessException(400,
                    "品种未映射：作物「" + nullSafe(batch.getCropName()) + "」在交易端找不到对应品类，请先在「品种对接表」补齐映射");
        }
        P2tVarietyMap map = maps.stream()
                .filter(m -> isBlank(categoryCode) || Objects.equals(m.getCategoryCode(), categoryCode))
                .findFirst()
                .orElseThrow(() -> new BusinessException(400, "所选交易品类不在该品种的映射范围内：" + categoryCode));

        assertStockCapacity(batch, tenantId, null, qty);

        P2tOffer offer = new P2tOffer();
        offer.setTenantId(tenantId);
        offer.setOfferNo(nextOfferNo(tenantId));
        offer.setBatchId(batchId);
        offer.setBatchNo(batch.getBatchNo());
        offer.setCropId(batch.getCropId());
        offer.setCropName(batch.getCropName());
        offer.setVarietyName(firstNonBlank(map.getVarietyName(), batch.getCropVariety()));
        offer.setCategoryCode(map.getCategoryCode());
        offer.setCategoryName(map.getCategoryName());
        offer.setFarmId(batch.getFarmId());
        offer.setFarmName(batch.getFarmName());
        offer.setOrigin(buildOrigin(batch, map));
        offer.setUnit(isBlank(batch.getUnit()) ? "kg" : batch.getUnit());
        offer.setAvailableQty(qty);
        offer.setReservedQty(BigDecimal.ZERO);
        offer.setMinOrderQty(toDecimal(payload.get("minOrderQty")) == null
                ? BigDecimal.ZERO : toDecimal(payload.get("minOrderQty")));
        offer.setDeliveryType(isBlank(str(payload.get("deliveryType"))) ? "WAREHOUSE" : str(payload.get("deliveryType")));
        offer.setWindowStart(toDate(payload.get("windowStart"), batch.getHarvestDate().plusDays(3)));
        offer.setWindowEnd(toDate(payload.get("windowEnd"), offer.getWindowStart().plusDays(30)));
        if (offer.getWindowEnd().isBefore(offer.getWindowStart())) {
            throw new BusinessException(400, "上市窗口结束日不能早于开始日");
        }
        offer.setGradeARatio(nz(toDecimal(payload.get("gradeARatio"))));
        offer.setGradeBRatio(nz(toDecimal(payload.get("gradeBRatio"))));
        offer.setGradeCRatio(nz(toDecimal(payload.get("gradeCRatio"))));
        offer.setQualityNo(batch.getInspectionNo());
        offer.setQualityValidUntil(null);
        offer.setTraceCodeSeg(batch.getTraceCode());
        offer.setPriceRefMin(toDecimal(payload.get("priceRefMin")));
        offer.setPriceRefMax(toDecimal(payload.get("priceRefMax")));
        offer.setAuditStatus("PENDING");
        offer.setTradeStatus("PENDING");
        offer.setPublishTime(LocalDateTime.now());
        offer.setRemark(str(payload.get("remark")));
        offer.setCreateTime(LocalDateTime.now());
        offer.setUpdateTime(LocalDateTime.now());
        offer.setDeleted(0);
        validateOffer(offer);
        offerMapper.insert(offer);
        return offer;
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tOffer updateOffer(Long id, Map<String, Object> payload, String tenantId) {
        P2tOffer offer = requireOffer(id, tenantId);
        if (!"PENDING".equals(offer.getTradeStatus())) {
            throw new BusinessException(400, "只有待发布供给单可以编辑，已进入交易流程请走供给变更");
        }
        HarvestBatch batch = harvestBatchMapper.lockOwned(offer.getBatchId(), tenantId);
        if (batch == null) throw new BusinessException(404, "关联采收批次不存在");
        BigDecimal qty = toDecimal(payload.get("availableQty"));
        if (qty != null) {
            if (qty.signum() <= 0) {
                throw new BusinessException(400, "可供量必须大于 0");
            }
            if (qty.compareTo(nz(offer.getReservedQty())) < 0) {
                throw new BusinessException(400, "调整后可供量不能低于已认购量：" + nz(offer.getReservedQty()).toPlainString());
            }
            offer.setAvailableQty(qty);
        }
        if (payload.get("minOrderQty") != null) offer.setMinOrderQty(toDecimal(payload.get("minOrderQty")));
        if (payload.get("deliveryType") != null) offer.setDeliveryType(str(payload.get("deliveryType")));
        if (payload.get("windowStart") != null) offer.setWindowStart(toDate(payload.get("windowStart"), offer.getWindowStart()));
        if (payload.get("windowEnd") != null) offer.setWindowEnd(toDate(payload.get("windowEnd"), offer.getWindowEnd()));
        if (payload.get("gradeARatio") != null) offer.setGradeARatio(nz(toDecimal(payload.get("gradeARatio"))));
        if (payload.get("gradeBRatio") != null) offer.setGradeBRatio(nz(toDecimal(payload.get("gradeBRatio"))));
        if (payload.get("gradeCRatio") != null) offer.setGradeCRatio(nz(toDecimal(payload.get("gradeCRatio"))));
        if (payload.get("priceRefMin") != null) offer.setPriceRefMin(toDecimal(payload.get("priceRefMin")));
        if (payload.get("priceRefMax") != null) offer.setPriceRefMax(toDecimal(payload.get("priceRefMax")));
        if (payload.get("remark") != null) offer.setRemark(str(payload.get("remark")));
        if (offer.getWindowStart() != null && offer.getWindowEnd() != null && offer.getWindowEnd().isBefore(offer.getWindowStart()))
            throw new BusinessException(400, "上市窗口结束日不能早于开始日");
        validateOffer(offer);
        assertStockCapacity(batch, tenantId, id, nz(offer.getAvailableQty()));
        // 修改后重新提交审核：保留原供给单号
        offer.setAuditStatus("PENDING");
        offer.setAuditRemark(null);
        offer.setAuditTime(null);
        offer.setAuditor(null);
        offer.setPublishTime(LocalDateTime.now());
        offer.setUpdateTime(LocalDateTime.now());
        offerMapper.updateById(offer);
        return offer;
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tOffer submitOffer(Long id, String tenantId) {
        P2tOffer offer = requireOffer(id, tenantId);
        if (!"PENDING".equals(offer.getTradeStatus())) {
            throw new BusinessException(400, "只有待建品供给可以重新提交");
        }
        HarvestBatch batch = harvestBatchMapper.lockOwned(offer.getBatchId(), offer.getTenantId());
        assertStockCapacity(batch, offer.getTenantId(), offer.getId(), nz(offer.getAvailableQty()));
        offer.setAuditStatus("PENDING");
        offer.setAuditRemark(null);
        offer.setAuditTime(null);
        offer.setPublishTime(LocalDateTime.now());
        offer.setUpdateTime(LocalDateTime.now());
        offerMapper.updateById(offer);
        return offer;
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tOffer closeOffer(Long id, String tenantId) {
        P2tOffer offer = requireOffer(id, tenantId);
        if (!"PENDING".equals(offer.getTradeStatus()) || nz(offer.getReservedQty()).signum() > 0) {
            throw new BusinessException(400, "只有未认购的待建品供给可以关闭");
        }
        offer.setTradeStatus("CLOSED");
        offer.setUpdateTime(LocalDateTime.now());
        offerMapper.updateById(offer);
        return offer;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteOffer(Long id, String tenantId) {
        P2tOffer offer = requireOffer(id, tenantId);
        if (!("PENDING".equals(offer.getTradeStatus()) || "CLOSED".equals(offer.getTradeStatus()))
                || nz(offer.getReservedQty()).signum() > 0) {
            throw new BusinessException(400, "只有未认购且未上架的供给可以删除");
        }
        offerMapper.deleteById(id);
    }

    private P2tOffer requireOffer(Long id, String tenantId) {
        P2tOffer snapshot = offerMapper.selectOne(new LambdaQueryWrapper<P2tOffer>().eq(P2tOffer::getId, id).eq(P2tOffer::getTenantId, tenantId));
        if (snapshot == null) throw new BusinessException(404, "供给单不存在");
        harvestBatchMapper.lockOwned(snapshot.getBatchId(), snapshot.getTenantId());
        P2tOffer offer = offerMapper.selectOne(new LambdaQueryWrapper<P2tOffer>().eq(P2tOffer::getId, id)
                .eq(P2tOffer::getTenantId, tenantId).last("FOR UPDATE"));
        if (offer == null || !Objects.equals(offer.getTenantId(), tenantId)) {
            throw new BusinessException(404, "供给单不存在");
        }
        return offer;
    }

    /* ==================== 交易端：供给池 / 审核 / 建品回写 ==================== */

    public PageResult<P2tOffer> pagePool(int pageNum, int pageSize, String keyword, String auditStatus,
                                         String tenantId) {
        LambdaQueryWrapper<P2tOffer> w = new LambdaQueryWrapper<>();
        // tenantId 为空 = 平台级服务通道：交易运营端看所有生产主体的供给
        if (tenantId != null) {
            w.eq(P2tOffer::getTenantId, tenantId);
        }
        w.in(P2tOffer::getTradeStatus, OPEN_TRADE_STATUS);
        if (!isBlank(auditStatus)) {
            w.eq(P2tOffer::getAuditStatus, auditStatus.trim().toUpperCase());
        }
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(P2tOffer::getOfferNo, kw)
                    .or().like(P2tOffer::getCropName, kw)
                    .or().like(P2tOffer::getCategoryName, kw)
                    .or().like(P2tOffer::getFarmName, kw));
        }
        w.orderByAsc(P2tOffer::getAuditStatus).orderByAsc(P2tOffer::getPublishTime)
                .orderByDesc(P2tOffer::getId);
        Page<P2tOffer> page = offerMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        return PageResult.of(page.getRecords(), page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tOffer auditOffer(String offerNo, boolean approved, String remark, String auditor, String tenantId) {
        P2tOffer offer = lockOffer(offerNo, tenantId);
        if (!"PENDING".equals(offer.getTradeStatus()) || !"PENDING".equals(offer.getAuditStatus())) {
            throw new BusinessException(400, "该供给单当前不是待审核状态");
        }
        if (!approved && isBlank(remark)) {
            throw new BusinessException(400, "驳回时必须填写审批意见");
        }
        if (approved) assertStockCapacity(harvestBatchMapper.lockOwned(offer.getBatchId(), offer.getTenantId()), offer.getTenantId(), offer.getId(), nz(offer.getAvailableQty()));
        offer.setAuditStatus(approved ? "APPROVED" : "REJECTED");
        offer.setAuditRemark(remark);
        offer.setAuditor(auditor);
        offer.setAuditTime(LocalDateTime.now());
        offer.setUpdateTime(LocalDateTime.now());
        offerMapper.updateById(offer);
        return offer;
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tOffer markListed(String offerNo, String productCode, String productName, BigDecimal listedQty,
                               BigDecimal listedPrice, String tenantId) {
        P2tOffer offer = lockOffer(offerNo, tenantId);
        if (!"PENDING".equals(offer.getTradeStatus()) || !"APPROVED".equals(offer.getAuditStatus())) {
            throw new BusinessException(400, "供给单未审核通过，不能建品上架");
        }
        if (isBlank(productCode) || listedQty == null || listedQty.signum() <= 0
                || listedPrice == null || listedPrice.signum() < 0)
            throw new BusinessException(400, "商品编号、正数上架量和非负价格不能为空");
        assertStockCapacity(harvestBatchMapper.lockOwned(offer.getBatchId(), offer.getTenantId()), offer.getTenantId(), offer.getId(), nz(offer.getAvailableQty()));
        BigDecimal maxListable = nz(offer.getAvailableQty()).subtract(nz(offer.getReservedQty()));
        if (listedQty != null && listedQty.compareTo(maxListable) > 0) {
            throw new BusinessException(400, "上架可售量超过供给可售上限：" + maxListable.stripTrailingZeros().toPlainString());
        }
        offer.setProductCode(productCode);
        offer.setProductName(productName);
        offer.setListedQty(listedQty);
        offer.setListedPrice(listedPrice);
        offer.setListedTime(LocalDateTime.now());
        offer.setTradeStatus("LISTED");
        offer.setUpdateTime(LocalDateTime.now());
        offerMapper.updateById(offer);
        return offer;
    }

    /* ==================== 认购回写 ==================== */

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> writeback(Map<String, Object> payload, String tenantId) {
        String offerNo = str(payload.get("offerNo"));
        String orderNo = str(payload.get("orderNo"));
        if (isBlank(offerNo) || isBlank(orderNo)) {
            throw new BusinessException(400, "回写缺少 offerNo / orderNo");
        }
        String eventType = isBlank(str(payload.get("eventType"))) ? "ORDER_PAID" : str(payload.get("eventType"));
        if (!List.of("ORDER_PAID", "ORDER_CANCELLED", "RELEASED").contains(eventType))
            throw new BusinessException(400, "不支持的认购事件类型");
        BigDecimal qty = toDecimal(payload.get("qty"));
        if (qty == null || qty.signum() <= 0) throw new BusinessException(400, "回写数量必须大于 0");
        P2tOffer offer = lockOffer(offerNo, tenantId);
        // 先确认归属并锁定供给，再处理幂等；兼容历史键，不返回其他供给的结果。
        String idem = "P2T:" + offer.getId() + ":" + org.springframework.util.DigestUtils.md5DigestAsHex(
                (orderNo + ":" + eventType).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        P2tSubscription exists = subscriptionMapper.selectOne(new LambdaQueryWrapper<P2tSubscription>()
                .eq(P2tSubscription::getTenantId, offer.getTenantId())
                .eq(P2tSubscription::getOfferNo, offerNo).eq(P2tSubscription::getOrderNo, orderNo)
                .eq(P2tSubscription::getEventType, eventType).last("LIMIT 1"));
        if (exists != null) {
            if (nz(exists.getQty()).compareTo(qty) != 0)
                throw new BusinessException(400, "重复回写数量与原事件不一致");
            return Map.of("duplicated", true, "subscriptionId", exists.getId());
        }
        if (!List.of("LISTED", "SOLD").contains(offer.getTradeStatus()))
            throw new BusinessException(400, "只有已上架供给可以接收认购回写");
        boolean release = !"ORDER_PAID".equals(eventType);
        if (release) {
            BigDecimal orderNet = subscriptionMapper.selectList(new LambdaQueryWrapper<P2tSubscription>()
                    .eq(P2tSubscription::getTenantId, offer.getTenantId())
                    .eq(P2tSubscription::getOfferNo, offerNo).eq(P2tSubscription::getOrderNo, orderNo))
                    .stream().map(row -> "ORDER_PAID".equals(row.getEventType()) ? nz(row.getQty())
                        : List.of("ORDER_CANCELLED", "RELEASED").contains(row.getEventType())
                            ? nz(row.getQty()).negate() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (qty.compareTo(orderNet) > 0) throw new BusinessException(400, "冲销数量超过该订单剩余认购量");
        }
        if (!release) assertStockCapacity(harvestBatchMapper.lockOwned(offer.getBatchId(), offer.getTenantId()), offer.getTenantId(), offer.getId(), nz(offer.getAvailableQty()));
        BigDecimal signed = release ? qty.negate() : qty;
        BigDecimal reserved = nz(offer.getReservedQty()).add(signed);
        if (reserved.signum() < 0) throw new BusinessException(400, "冲销数量超过供给已认购量");
        if (reserved.compareTo(nz(offer.getAvailableQty())) > 0) {
            // 硬约束：已认购不得超过可供量（超卖必须为 0）
            throw new BusinessException(400, "回写会导致超卖：已认购 " + reserved + " > 可供量 " + offer.getAvailableQty());
        }
        offer.setReservedQty(reserved);
        if (reserved.compareTo(nz(offer.getAvailableQty())) >= 0 && "LISTED".equals(offer.getTradeStatus())) {
            offer.setTradeStatus("SOLD");
        } else if ("SOLD".equals(offer.getTradeStatus()) && reserved.compareTo(nz(offer.getAvailableQty())) < 0) {
            offer.setTradeStatus("LISTED");
        }
        offer.setUpdateTime(LocalDateTime.now());
        offerMapper.updateById(offer);

        P2tSubscription sub = new P2tSubscription();
        sub.setTenantId(offer.getTenantId());
        sub.setOfferNo(offerNo);
        sub.setBatchNo(offer.getBatchNo());
        sub.setOrderNo(orderNo);
        sub.setBuyerName(str(payload.get("buyerName")));
        sub.setBuyerType(str(payload.get("buyerType")));
        sub.setQty(qty);
        sub.setGrade(str(payload.get("grade")));
        sub.setLockFrom(toDate(payload.get("lockFrom"), LocalDate.now()));
        sub.setLockTo(toDate(payload.get("lockTo"), LocalDate.now().plusDays(10)));
        sub.setEventType(eventType);
        sub.setWritebackStatus("SUCCESS");
        sub.setIdempotentKey(idem);
        sub.setPaidAt(LocalDateTime.now());
        sub.setCreateTime(LocalDateTime.now());
        subscriptionMapper.insert(sub);

        return Map.of("duplicated", false, "subscriptionId", sub.getId(),
                "reservedQty", reserved, "tradeStatus", offer.getTradeStatus());
    }

    public PageResult<Map<String, Object>> pageSubscriptionSummary(int pageNum, int pageSize, String keyword,
                                                                   String tenantId) {
        LambdaQueryWrapper<P2tOffer> w = new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId)
                .in(P2tOffer::getTradeStatus, OPEN_TRADE_STATUS);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(P2tOffer::getOfferNo, kw).or().like(P2tOffer::getCropName, kw));
        }
        w.orderByDesc(P2tOffer::getUpdateTime);
        Page<P2tOffer> page = offerMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        List<Map<String, Object>> rows = page.getRecords().stream().map(this::subscriptionRow).toList();
        return PageResult.of(rows, page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    private Map<String, Object> subscriptionRow(P2tOffer offer) {
        BigDecimal available = nz(offer.getAvailableQty());
        BigDecimal reserved = nz(offer.getReservedQty());
        BigDecimal rate = available.signum() == 0 ? BigDecimal.ZERO
                : reserved.divide(available, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                        .setScale(1, RoundingMode.HALF_UP);
        P2tSubscription latest = subscriptionMapper.selectOne(new LambdaQueryWrapper<P2tSubscription>()
                .eq(P2tSubscription::getOfferNo, offer.getOfferNo())
                .orderByDesc(P2tSubscription::getCreateTime).last("LIMIT 1"));
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("offerNo", offer.getOfferNo());
        row.put("cropName", offer.getCropName());
        row.put("varietyName", offer.getVarietyName());
        row.put("categoryName", offer.getCategoryName());
        row.put("availableQty", available);
        row.put("reservedQty", reserved);
        row.put("remainingQty", offer.getRemainingQty());
        row.put("subscriptionRate", rate);
        row.put("unit", offer.getUnit());
        row.put("tradeStatus", offer.getTradeStatus());
        row.put("auditStatus", offer.getAuditStatus());
        row.put("latestWriteback", latest == null ? null : latest.getCreateTime());
        return row;
    }

    public PageResult<P2tSubscription> pageSubscriptionFlows(int pageNum, int pageSize, String keyword,
                                                             String tenantId) {
        return pageSubscriptionFlows(pageNum, pageSize, keyword, null, null, null, tenantId);
    }

    public PageResult<P2tSubscription> pageSubscriptionFlows(int pageNum, int pageSize, String keyword,
            String offerNo, String eventType, String writebackStatus, String tenantId) {
        if (isBlank(tenantId)) throw new BusinessException(400, "请先选择当前经营主体");
        if (!isBlank(offerNo)) findOffer(offerNo.trim(), tenantId);
        LambdaQueryWrapper<P2tSubscription> w = new LambdaQueryWrapper<P2tSubscription>()
                .eq(P2tSubscription::getTenantId, tenantId);
        if (!isBlank(offerNo)) w.eq(P2tSubscription::getOfferNo, offerNo.trim());
        if (!isBlank(eventType)) w.eq(P2tSubscription::getEventType, eventType.trim());
        if (!isBlank(writebackStatus)) w.eq(P2tSubscription::getWritebackStatus, writebackStatus.trim());
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(P2tSubscription::getOrderNo, kw)
                    .or().like(P2tSubscription::getOfferNo, kw)
                    .or().like(P2tSubscription::getBuyerName, kw));
        }
        w.orderByDesc(P2tSubscription::getCreateTime).orderByDesc(P2tSubscription::getId);
        Page<P2tSubscription> page = subscriptionMapper.selectPage(
                new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        return PageResult.of(page.getRecords(), page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    /* ==================== 需求反哺 ==================== */

    public List<Map<String, Object>> demandSignals(String tenantId) {
        return demandSignals(tenantId, null, null);
    }

    public List<Map<String, Object>> demandSignals(String tenantId, LocalDate startDate, LocalDate endDate) {
        if (isBlank(tenantId)) throw new BusinessException(400, "请先选择当前经营主体");
        if ((startDate == null) != (endDate == null)) throw new BusinessException(400, "请选择完整的统计日期范围");
        if (startDate != null && startDate.isAfter(endDate)) throw new BusinessException(400, "开始日期不能晚于结束日期");
        if (endDate != null && endDate.isAfter(LocalDate.now())) throw new BusinessException(400, "统计结束日期不能晚于今天");
        List<P2tOffer> offers = offerMapper.selectList(new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId));
        List<P2tSubscription> events = subscriptionMapper.selectList(new LambdaQueryWrapper<P2tSubscription>()
                .eq(P2tSubscription::getTenantId, tenantId)
                .eq(P2tSubscription::getWritebackStatus, "SUCCESS")
                .in(P2tSubscription::getEventType, List.of("ORDER_PAID", "ORDER_CANCELLED", "RELEASED")));
        Map<String, List<P2tSubscription>> byOffer = events.stream()
                .filter(e -> tenantId.equals(e.getTenantId()) && "SUCCESS".equals(e.getWritebackStatus()) && e.getOfferNo() != null)
                .collect(Collectors.groupingBy(P2tSubscription::getOfferNo));
        Map<List<String>, List<P2tOffer>> groups = offers.stream()
                .filter(o -> tenantId.equals(o.getTenantId()) && !isBlank(o.getCategoryCode()))
                .collect(Collectors.groupingBy(o -> List.of(o.getCategoryCode(), isBlank(o.getUnit()) ? "未标注" : o.getUnit().trim()),
                        LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<List<String>, List<P2tOffer>> entry : groups.entrySet()) {
            List<P2tOffer> group = entry.getValue();
            P2tOffer sample = group.get(0);
            BigDecimal paid = BigDecimal.ZERO, released = BigDecimal.ZERO, net = BigDecimal.ZERO;
            BigDecimal supply = BigDecimal.ZERO, onSale = BigDecimal.ZERO;
            BigDecimal periodPaid = BigDecimal.ZERO, periodReleased = BigDecimal.ZERO, opening = BigDecimal.ZERO;
            int count = 0;
            boolean anomaly = "未标注".equals(entry.getKey().get(1));
            for (P2tOffer offer : group) {
                BigDecimal offerPaid = BigDecimal.ZERO, offerReleased = BigDecimal.ZERO;
                BigDecimal beforePaid = BigDecimal.ZERO, beforeReleased = BigDecimal.ZERO;
                for (P2tSubscription event : byOffer.getOrDefault(offer.getOfferNo(), List.of())) {
                    if (!List.of("ORDER_PAID", "ORDER_CANCELLED", "RELEASED").contains(Objects.toString(event.getEventType(), ""))) continue;
                    LocalDate date = event.getCreateTime() == null ? null : event.getCreateTime().toLocalDate();
                    if (startDate != null && date == null) { anomaly = true; continue; }
                    if (endDate != null && date.isAfter(endDate)) continue;
                    BigDecimal qty = nz(event.getQty());
                    if (qty.signum() < 0) { anomaly = true; continue; }
                    boolean payment = "ORDER_PAID".equals(event.getEventType());
                    if (startDate != null && date.isBefore(startDate)) {
                        if (payment) beforePaid = beforePaid.add(qty); else beforeReleased = beforeReleased.add(qty);
                    } else {
                        if (payment) periodPaid = periodPaid.add(qty); else periodReleased = periodReleased.add(qty);
                    }
                    if ("ORDER_PAID".equals(event.getEventType())) offerPaid = offerPaid.add(qty);
                    else if (List.of("ORDER_CANCELLED", "RELEASED").contains(event.getEventType())) offerReleased = offerReleased.add(qty);
                }
                opening = opening.add(beforePaid.subtract(beforeReleased).max(BigDecimal.ZERO));
                BigDecimal rawNet = offerPaid.subtract(offerReleased);
                BigDecimal offerNet = rawNet.max(BigDecimal.ZERO);
                BigDecimal capacity = nz(offer.getAvailableQty()).max(BigDecimal.ZERO);
                boolean accepted = "APPROVED".equals(offer.getAuditStatus())
                        && List.of("LISTED", "SOLD", "CLOSED").contains(Objects.toString(offer.getTradeStatus(), ""));
                if (!accepted && offerPaid.signum() == 0 && offerReleased.signum() == 0) continue;
                count++;
                anomaly |= rawNet.signum() < 0 || offerNet.compareTo(capacity) > 0;
                paid = paid.add(offerPaid);
                released = released.add(offerReleased);
                net = net.add(offerNet);
                supply = supply.add(capacity);
                if ("APPROVED".equals(offer.getAuditStatus()) && "LISTED".equals(offer.getTradeStatus()))
                    onSale = onSale.add(capacity.subtract(startDate == null ? offerNet : nz(offer.getReservedQty())).max(BigDecimal.ZERO));
            }
            if (count == 0) continue;
            BigDecimal rate = supply.signum() == 0 ? BigDecimal.ZERO
                    : net.multiply(new BigDecimal("100")).divide(supply, 1, RoundingMode.HALF_UP);
            String judgement, suggestion;
            if (anomaly || supply.signum() == 0) {
                judgement = "数据待核查";
                suggestion = "先核对单位、供给数量及认购冲销流水，暂不形成排产建议";
            } else if (paid.signum() == 0) {
                judgement = "暂无认购";
                suggestion = "尚无成功支付回写，继续观察需求，暂不据此调整种植面积";
            } else if (rate.compareTo(new BigDecimal("70")) >= 0) {
                judgement = "认购较高";
                suggestion = "结合履约、库存与销售周期评估后续供应，避免仅凭累计认购率扩种";
            } else if (rate.compareTo(new BigDecimal("35")) >= 0) {
                judgement = "认购适中";
                suggestion = "结合交付窗口持续观察净认购变化，审慎安排后续排产";
            } else {
                judgement = "认购偏低";
                suggestion = "先核查取消原因与销售周期，再评估供给节奏和渠道";
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("categoryCode", entry.getKey().get(0));
            row.put("unit", entry.getKey().get(1));
            row.put("categoryName", sample.getCategoryName());
            row.put("cropName", group.stream().map(P2tOffer::getCropName).filter(Objects::nonNull).distinct().collect(Collectors.joining("、")));
            row.put("periodPaidQty", periodPaid);
            row.put("periodReleasedQty", periodReleased);
            row.put("periodNetQty", periodPaid.subtract(periodReleased));
            row.put("openingNetQty", opening);
            row.put("paidQty", paid);
            row.put("releasedQty", released);
            row.put("tradedQty", net);
            row.put("subscriptionRate", rate);
            row.put("supplyQty", supply);
            row.put("onSaleQty", onSale);
            row.put("offerCount", count);
            row.put("dataAnomaly", anomaly || supply.signum() == 0);
            row.put("judgement", judgement);
            row.put("suggestion", suggestion);
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> (BigDecimal) r.get("subscriptionRate")).reversed());
        return rows;
    }

    /* ==================== 差异工单 ==================== */

    public PageResult<P2tDiffTicket> pageDiffs(int pageNum, int pageSize, String status, String tenantId) {
        return pageDiffs(pageNum, pageSize, status, null, null, tenantId);
    }

    public PageResult<P2tDiffTicket> pageDiffs(int pageNum, int pageSize, String status, String diffType, String keyword, String tenantId) {
        LambdaQueryWrapper<P2tDiffTicket> w = new LambdaQueryWrapper<>();
        if (!isBlank(diffType)) w.eq(P2tDiffTicket::getDiffType, diffType.trim().toUpperCase());
        if (!isBlank(keyword)) {
            String kw = keyword.trim();
            w.and(q -> q.like(P2tDiffTicket::getTicketNo, kw).or().like(P2tDiffTicket::getOfferNo, kw).or().like(P2tDiffTicket::getOrderNo, kw));
        }
        if (tenantId != null) {
            w.eq(P2tDiffTicket::getTenantId, tenantId);
        }
        if (!isBlank(status)) {
            w.eq(P2tDiffTicket::getStatus, status.trim().toUpperCase());
        }
        w.orderByAsc(P2tDiffTicket::getStatus).orderByDesc(P2tDiffTicket::getDiscoveredAt).orderByDesc(P2tDiffTicket::getId);
        Page<P2tDiffTicket> page = diffMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)), w);
        return PageResult.of(page.getRecords(), page.getTotal(), safePage(pageNum), safeSize(pageSize));
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tDiffTicket handleDiff(Long id, String status, String handleWay, String remark, String tenantId) {
        return handleDiff(id, status, handleWay, remark, null, null, tenantId);
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tDiffTicket handleDiff(Long id, String status, String handleWay, String remark,
                                  String evidenceNo, String expectedStatus, String tenantId) {
        if (isBlank(tenantId)) throw new BusinessException(403, "请以绑定经营主体的身份登记处置，平台通道不可代为关闭");
        P2tDiffTicket ticket = diffMapper.selectOne(new LambdaQueryWrapper<P2tDiffTicket>()
                .eq(P2tDiffTicket::getId, id).eq(P2tDiffTicket::getTenantId, tenantId).last("FOR UPDATE"));
        if (ticket == null) throw new BusinessException(404, "差异工单不存在");
        if (!"PRODUCTION".equals(ticket.getOwnerSide())) throw new BusinessException(403, "该工单由交易侧或系统负责，生产端仅可查看");
        if ("CLOSED".equals(ticket.getStatus())) throw new BusinessException(400, "工单已关闭，不可重复处置");
        if (isBlank(expectedStatus) || !expectedStatus.equals(ticket.getStatus())) throw new BusinessException(409, "工单状态已变化，请刷新后操作");
        if (isBlank(remark) || remark.trim().length() > 200) throw new BusinessException(400, "请填写不超过200字的本次处置结果");
        String nextStatus = isBlank(status) ? "PROCESSING" : status.trim().toUpperCase();
        if (!List.of("PROCESSING", "CLOSED").contains(nextStatus)) throw new BusinessException(400, "无效处置状态");
        if (!List.of("PENDING", "OPEN", "PROCESSING").contains(ticket.getStatus())) throw new BusinessException(400, "当前工单状态不可处置");
        if (handleWay == null || !List.of("补发", "降级", "退款", "其他").contains(handleWay)) throw new BusinessException(400, "请选择有效处置方式");
        String evidence = "";
        if ("CLOSED".equals(nextStatus)) {
            if (!"PROCESSING".equals(ticket.getStatus())) throw new BusinessException(400, "请先登记处理过程，再核验关闭");
            if (!List.of("退款", "补发", "降级").contains(handleWay)) throw new BusinessException(400, "该方式尚无可核验的执行凭据，请保留处理中；不可凭备注关闭");
            if (isBlank(evidenceNo) || evidenceNo.trim().length() > 64 || !evidenceNo.trim().matches("[A-Za-z0-9_-]+")) throw new BusinessException(400, "请填写有效凭据单号（最多64字符）");
            if (isBlank(ticket.getOfferNo()) || isBlank(ticket.getOrderNo())) throw new BusinessException(400, "工单缺少原供给或订单关联，不能核验关闭");
            P2tOffer offer = offerMapper.selectOne(new LambdaQueryWrapper<P2tOffer>()
                    .eq(P2tOffer::getTenantId, tenantId).eq(P2tOffer::getOfferNo, ticket.getOfferNo()));
            if (offer == null) throw new BusinessException(404, "当前主体下原供给单不存在");
            if ("降级".equals(handleWay)) {
                gradeReviewService.consume(evidenceNo.trim(), ticket, offer, tenantId);
                evidence = "；等级复核=" + evidenceNo.trim() + "（双人确认，仅认定履约商品等级，不含价款调整）";
            } else if ("补发".equals(handleWay)) {
                if (!"SHORT_SHIP".equals(ticket.getDiffType()) || ticket.getDiffQty() == null || ticket.getDiffQty().signum() <= 0 || isBlank(offer.getUnit()))
                    throw new BusinessException(400, "仅支持差异量明确且单位有效的短装工单补发关闭");
                diffEvidenceClient.verifyDiffReship(ticket.getOfferNo(), ticket.getOrderNo(), ticket.getTicketNo(),
                        evidenceNo.trim(), ticket.getDiffQty(), offer.getUnit(), tenantId);
                evidence = "；补发物流=" + evidenceNo.trim() + "（足额补发，买方确认签收）";
            } else {
                diffEvidenceClient.verifyDiffRefund(ticket.getOfferNo(), ticket.getOrderNo(), evidenceNo.trim(), tenantId);
                evidence = "；凭据=" + evidenceNo.trim() + "（交易账务全额退款，非外部到账证明）";
            }
        }
        LocalDateTime now = LocalDateTime.now();
        String actor = TenantContextService.currentUserId();
        String entry = "操作人=" + (actor == null ? "未提供" : actor) + " " + now.format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) + " " + nextStatus + " " + handleWay + "：" + remark.trim() + evidence;
        String history = isBlank(ticket.getHandleRemark()) ? entry : ticket.getHandleRemark() + "\n" + entry;
        if (history.length() > 500) throw new BusinessException(400, "处置历史已接近500字容量，请精简本次说明；历史不会被覆盖");
        ticket.setStatus(nextStatus);
        ticket.setHandleWay(handleWay);
        ticket.setHandleRemark(history);
        ticket.setHandleTime(now);
        ticket.setUpdateTime(now);
        if (diffMapper.updateById(ticket) != 1) throw new BusinessException(409, "保存失败，请刷新后重试");
        return ticket;
    }

    /** 交易端登记补发前查询，仍按登录用户选定主体隔离。 */
    public Map<String, Object> reshipRequirement(String ticketNo, String tenantId) {
        if (isBlank(ticketNo) || ticketNo.length() > 64) throw new BusinessException(400, "工单号无效");
        P2tDiffTicket ticket = diffMapper.selectOne(new LambdaQueryWrapper<P2tDiffTicket>()
                .eq(P2tDiffTicket::getTenantId, tenantId).eq(P2tDiffTicket::getTicketNo, ticketNo));
        if (ticket == null) throw new BusinessException(404, "当前主体下差异工单不存在");
        if (!"PRODUCTION".equals(ticket.getOwnerSide()) || !"SHORT_SHIP".equals(ticket.getDiffType())
                || !"PROCESSING".equals(ticket.getStatus()) || !"补发".equals(ticket.getHandleWay())
                || ticket.getDiffQty() == null || ticket.getDiffQty().signum() <= 0
                || isBlank(ticket.getOrderNo()) || isBlank(ticket.getOfferNo()))
            throw new BusinessException(400, "请先将短装工单登记为处理中、处置方式为补发");
        P2tOffer offer = offerMapper.selectOne(new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId).eq(P2tOffer::getOfferNo, ticket.getOfferNo()));
        if (offer == null || isBlank(offer.getUnit())) throw new BusinessException(400, "原供给缺失或单位无效");
        return Map.of("ticketNo", ticket.getTicketNo(), "offerNo", ticket.getOfferNo(), "orderNo", ticket.getOrderNo(),
                "quantity", ticket.getDiffQty(), "unit", offer.getUnit());
    }

    /* ==================== 对账 / 链路 / 概览 ==================== */

    public List<Map<String, Object>> reconciliation(String tenantId) {
        LambdaQueryWrapper<P2tOffer> w = new LambdaQueryWrapper<P2tOffer>()
                .in(P2tOffer::getTradeStatus, OPEN_TRADE_STATUS)
                .orderByDesc(P2tOffer::getPublishTime);
        if (tenantId != null) {
            w.eq(P2tOffer::getTenantId, tenantId);
        }
        List<P2tOffer> offers = offerMapper.selectList(w);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (P2tOffer offer : offers) {
            BigDecimal supply = nz(offer.getAvailableQty());
            BigDecimal traded = nz(offer.getReservedQty());
            // 入仓量由仓储管理产生，生产端不持有；此处只给出成交口径与差异提示
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("offerNo", offer.getOfferNo());
            row.put("cropName", offer.getCropName());
            row.put("unit", offer.getUnit());
            row.put("supplyQty", supply);
            row.put("tradedQty", traded);
            row.put("remainingQty", offer.getRemainingQty());
            row.put("tradeRate", supply.signum() == 0 ? BigDecimal.ZERO
                    : traded.divide(supply, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                    .setScale(1, RoundingMode.HALF_UP));
            row.put("auditStatus", offer.getAuditStatus());
            row.put("tradeStatus", offer.getTradeStatus());
            row.put("productCode", offer.getProductCode());
            row.put("batchNo", offer.getBatchNo());
            rows.add(row);
        }
        return rows;
    }

    public Map<String, Object> traceByBatch(String batchNo, String tenantId) {
        return traceByBatch(batchNo, tenantId, true);
    }

    public Map<String, Object> traceByBatch(String batchNo, String tenantId, boolean includeSubscriptions) {
        LambdaQueryWrapper<P2tOffer> offerWrapper = new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getBatchNo, batchNo)
                .orderByDesc(P2tOffer::getId);
        LambdaQueryWrapper<HarvestBatch> batchWrapper = new LambdaQueryWrapper<HarvestBatch>()
                .eq(HarvestBatch::getBatchNo, batchNo);
        if (tenantId != null) {
            offerWrapper.eq(P2tOffer::getTenantId, tenantId);
            batchWrapper.eq(HarvestBatch::getTenantId, tenantId);
        }
        List<P2tOffer> offers = offerMapper.selectList(offerWrapper);
        HarvestBatch batch = harvestBatchMapper.selectOne(batchWrapper.last("LIMIT 1"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("batch", batch);
        result.put("offers", offers);
        if (!includeSubscriptions) return result;
        LambdaQueryWrapper<P2tSubscription> subWrapper = new LambdaQueryWrapper<P2tSubscription>()
                .in(P2tSubscription::getOfferNo, offers.isEmpty()
                        ? List.of("__none__") : offers.stream().map(P2tOffer::getOfferNo).toList())
                .orderByAsc(P2tSubscription::getCreateTime);
        if (tenantId != null) {
            subWrapper.eq(P2tSubscription::getTenantId, tenantId);
        }
        result.put("subscriptions", subscriptionMapper.selectList(subWrapper));
        return result;
    }

    public Map<String, Object> overview(String tenantId) {
        List<P2tOffer> offers = offerMapper.selectList(new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId));
        BigDecimal supply = offers.stream().filter(o -> OPEN_TRADE_STATUS.contains(o.getTradeStatus()))
                .map(o -> nz(o.getAvailableQty())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal reserved = offers.stream().filter(o -> OPEN_TRADE_STATUS.contains(o.getTradeStatus()))
                .map(o -> nz(o.getReservedQty())).reduce(BigDecimal.ZERO, BigDecimal::add);
        long pendingAudit = offers.stream().filter(o -> "PENDING".equals(o.getAuditStatus()) && !"CLOSED".equals(o.getTradeStatus())).count();
        long pendingDiff = diffMapper.selectCount(new LambdaQueryWrapper<P2tDiffTicket>()
                .eq(P2tDiffTicket::getTenantId, tenantId)
                .ne(P2tDiffTicket::getStatus, "CLOSED"));
        long mapped = varietyMapper.selectCount(new LambdaQueryWrapper<P2tVarietyMap>()
                .eq(P2tVarietyMap::getTenantId, tenantId).eq(P2tVarietyMap::getStatus, 1));
        List<HarvestBatch> batches = harvestBatchMapper.selectList(new LambdaQueryWrapper<HarvestBatch>()
                .eq(HarvestBatch::getTenantId, tenantId));
        BigDecimal batchTotal = batches.stream().map(b -> nz(b.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal rate = supply.signum() == 0 ? BigDecimal.ZERO
                : reserved.divide(supply, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                        .setScale(1, RoundingMode.HALF_UP);

        Map<String, Object> data = new LinkedHashMap<>();
        Map<String, BigDecimal> supplyByUnit = new LinkedHashMap<>(), reservedByUnit = new LinkedHashMap<>(), harvestByUnit = new LinkedHashMap<>();
        for (P2tOffer o : offers) {
            String unit = isBlank(o.getUnit()) ? "未知单位" : o.getUnit().trim();
            supplyByUnit.merge(unit, occupiedQty(o), BigDecimal::add);
            reservedByUnit.merge(unit, nz(o.getReservedQty()), BigDecimal::add);
        }
        for (HarvestBatch b : batches) harvestByUnit.merge(isBlank(b.getUnit()) ? "kg" : b.getUnit().trim(), nz(b.getQuantity()), BigDecimal::add);
        data.put("supplyByUnit", supplyByUnit);
        data.put("reservedByUnit", reservedByUnit);
        data.put("harvestByUnit", harvestByUnit);
        data.put("supplyQty", supply);
        data.put("reservedQty", reserved);
        data.put("subscriptionRate", rate);
        data.put("pendingAudit", pendingAudit);
        data.put("pendingDiff", pendingDiff);
        data.put("mappedVarieties", mapped);
        data.put("batchCount", batches.size());
        data.put("batchQuantity", batchTotal);
        data.put("offerCount", offers.size());
        data.put("listedCount", offers.stream().filter(o -> "LISTED".equals(o.getTradeStatus())).count());
        return data;
    }

    /* ==================== 工具方法 ==================== */

    private P2tOffer lockOffer(String offerNo, String tenantId) {
        LambdaQueryWrapper<P2tOffer> query = new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getOfferNo, offerNo);
        if (tenantId != null) query.eq(P2tOffer::getTenantId, tenantId);
        LambdaQueryWrapper<P2tOffer> snapshotQuery = new LambdaQueryWrapper<P2tOffer>().eq(P2tOffer::getOfferNo, offerNo);
        if (tenantId != null) snapshotQuery.eq(P2tOffer::getTenantId, tenantId);
        P2tOffer snapshot = offerMapper.selectOne(snapshotQuery.last("LIMIT 1"));
        if (snapshot == null) throw new BusinessException(404, "供给单不存在");
        harvestBatchMapper.lockOwned(snapshot.getBatchId(), snapshot.getTenantId());
        P2tOffer offer = offerMapper.selectOne(query.last("FOR UPDATE"));
        if (offer == null) throw new BusinessException(404, "供给单不存在");
        return offer;
    }

    private void validateOffer(P2tOffer offer) {
        if (nz(offer.getMinOrderQty()).signum() < 0 || nz(offer.getMinOrderQty()).compareTo(offer.getAvailableQty()) > 0)
            throw new BusinessException(400, "起订量不能为负数或超过可供量");
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal ratio : List.of(nz(offer.getGradeARatio()), nz(offer.getGradeBRatio()), nz(offer.getGradeCRatio()))) {
            if (ratio.signum() < 0 || ratio.compareTo(new BigDecimal("100")) > 0)
                throw new BusinessException(400, "等级占比必须在 0 到 100 之间");
            total = total.add(ratio);
        }
        if (total.signum() != 0 && total.compareTo(new BigDecimal("100")) != 0)
            throw new BusinessException(400, "填写等级结构时各等级占比合计必须为 100%");
        if ((offer.getPriceRefMin() != null && offer.getPriceRefMin().signum() < 0)
                || (offer.getPriceRefMax() != null && offer.getPriceRefMax().signum() < 0)
                || (offer.getPriceRefMin() != null && offer.getPriceRefMax() != null
                    && offer.getPriceRefMin().compareTo(offer.getPriceRefMax()) > 0))
            throw new BusinessException(400, "参考价必须非负，且下限不能高于上限");
    }

    private String nextOfferNo(String tenantId) {
        String prefix = "OFFER" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return prefix + com.baomidou.mybatisplus.core.toolkit.IdWorker.getIdStr();
    }

    private String buildOrigin(HarvestBatch batch, P2tVarietyMap map) {
        String farm = isBlank(batch.getFarmName()) ? "" : batch.getFarmName();
        String origin = isBlank(map.getMainOrigin()) ? "" : map.getMainOrigin();
        if (!farm.isEmpty() && !origin.isEmpty()) return origin + " · " + farm;
        return farm.isEmpty() ? origin : farm;
    }

    private static int safePage(int v) { return v > 0 ? v : 1; }
    private static int safeSize(int v) { return v > 0 ? Math.min(v, 200) : 10; }
    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private static String nullSafe(String v) { return v == null ? "" : v; }
    private static boolean isBlank(String v) { return v == null || v.isBlank(); }
    private static String str(Object v) { return v == null ? null : String.valueOf(v).trim(); }

    private static String firstNonBlank(String a, String b) {
        return isBlank(a) ? (isBlank(b) ? null : b) : a;
    }

    private static BigDecimal toDecimal(Object v) {
        if (v == null) return null;
        try {
            String text = String.valueOf(v).trim();
            return text.isEmpty() ? null : new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "数字格式不正确：" + v);
        }
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        try {
            return Long.valueOf(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "标识格式不正确：" + v);
        }
    }

    private static LocalDate toDate(Object v, LocalDate fallback) {
        if (v == null) return fallback;
        String text = String.valueOf(v).trim();
        if (text.isEmpty()) return fallback;
        try {
            return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text);
        } catch (Exception e) {
            throw new BusinessException(400, "日期格式不正确（应为 yyyy-MM-dd）：" + v);
        }
    }
}
