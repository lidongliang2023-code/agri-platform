package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inventory;
import com.agri.production.entity.InventoryFlow;
import com.agri.production.entity.Plot;
import com.agri.production.entity.P2tOffer;
import com.agri.production.mapper.P2tOfferMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InventoryFlowMapper;
import com.agri.production.mapper.InventoryMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.IHarvestInventoryService;
import com.agri.production.service.IDomainEventService;
import com.agri.production.service.ITraceLifecycleService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;

/** 采收批次与成品库存（见 IHarvestInventoryService 的两条纪律）。 */
@Service
@Slf4j
public class HarvestInventoryServiceImpl implements IHarvestInventoryService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    /** 效期在这么多天以内算"临期"（与页面 resolveStockState 口径一致） */
    private static final int EXPIRING_DAYS = 30;

    private final HarvestBatchMapper batchMapper;
    private final InventoryMapper inventoryMapper;
    private final InventoryFlowMapper flowMapper;
    private final PlotMapper plotMapper;
    private final P2tOfferMapper offerMapper;
    private final IDomainEventService domainEventService;
    private final ITraceLifecycleService traceLifecycleService;

    public HarvestInventoryServiceImpl(HarvestBatchMapper batchMapper, InventoryMapper inventoryMapper,
                                      InventoryFlowMapper flowMapper, PlotMapper plotMapper,
                                      IDomainEventService domainEventService,
                                      ITraceLifecycleService traceLifecycleService, P2tOfferMapper offerMapper) {
        this.batchMapper = batchMapper;
        this.inventoryMapper = inventoryMapper;
        this.flowMapper = flowMapper;
        this.plotMapper = plotMapper;
        this.domainEventService = domainEventService;
        this.traceLifecycleService = traceLifecycleService;
        this.offerMapper = offerMapper;
    }

    /* ==================== 采收批次 ==================== */

    @Override
    public PageResult<HarvestBatch> pageBatches(int pageNum, int pageSize, Long farmId, Long plotId, Long cropId,
                                               String batchNo, String grade, Integer status, Integer inboundStatus,
                                               String startDate, String endDate, String tenantId) {
        LambdaQueryWrapper<HarvestBatch> w = new LambdaQueryWrapper<>();
        w.eq(HarvestBatch::getTenantId, tenantId);
        if (farmId != null) w.eq(HarvestBatch::getFarmId, farmId);
        if (plotId != null) w.eq(HarvestBatch::getPlotId, plotId);
        if (cropId != null) w.eq(HarvestBatch::getCropId, cropId);
        if (batchNo != null && !batchNo.isBlank()) w.like(HarvestBatch::getBatchNo, batchNo.trim());
        if (grade != null && !grade.isBlank()) w.eq(HarvestBatch::getGrade, grade.trim());
        if (status != null) w.eq(HarvestBatch::getStatus, status);
        if (inboundStatus != null) w.eq(HarvestBatch::getInboundStatus, inboundStatus);
        LocalDate from = parseDate(startDate);
        LocalDate to = parseDate(endDate);
        if (from != null) w.ge(HarvestBatch::getHarvestDate, from);
        if (to != null) w.le(HarvestBatch::getHarvestDate, to);
        w.orderByDesc(HarvestBatch::getHarvestDate).orderByDesc(HarvestBatch::getBatchId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<HarvestBatch> r = batchMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(r.getRecords(), r.getTotal(), p, s);
    }

    @Override
    public HarvestBatch detailBatch(Long batchId, String tenantId) {
        HarvestBatch batch = getOwnedBatch(batchId, tenantId);
        long count = offerMapper.selectCount(new LambdaQueryWrapper<P2tOffer>()
                .eq(P2tOffer::getTenantId, tenantId).eq(P2tOffer::getBatchId, batchId));
        batch.setLinkedOfferCount(count);
        batch.setMutationBlockedReason(count > 0 ? "已关联 " + count + " 条供给单，不能直接修改或删除采收批次"
                : !Integer.valueOf(0).equals(batch.getInboundStatus()) || Integer.valueOf(1).equals(batch.getTraceGenerated())
                ? "已入库或已赋码，不能直接修改或删除采收批次" : null);
        return batch;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HarvestBatch createBatch(Map<String, Object> body, String tenantId) {
        HarvestBatch batch = new HarvestBatch();
        batch.setTenantId(tenantId);
        applyBatch(batch, body);
        if (batch.getPlotId() == null) {
            throw new BusinessException(400, "请选择采收地块");
        }
        if (batch.getQuantity() == null || batch.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "采收数量必须大于 0");
        }
        if (batch.getBatchNo() == null) batch.setBatchNo(nextBatchNo(tenantId));
        if (batch.getHarvestDate() == null) batch.setHarvestDate(LocalDate.now());
        if (batch.getStatus() == null) batch.setStatus(1);
        if (batch.getInboundStatus() == null) batch.setInboundStatus(0);
        if (batch.getTraceGenerated() == null) batch.setTraceGenerated(0);
        validateBatch(batch, tenantId);
        batch.setCreateTime(LocalDateTime.now());
        batch.setUpdateTime(LocalDateTime.now());
        batch.setDeleted(0);
        try {
            batchMapper.insert(batch);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(400, "批次号已存在（含已删除的批次）：" + batch.getBatchNo());
        }
        return batch;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HarvestBatch updateBatch(Long batchId, Map<String, Object> body, String tenantId) {
        HarvestBatch batch = lockBatch(batchId, tenantId);
        assertNoLinkedOffers(batchId, tenantId);
        if (!Integer.valueOf(0).equals(batch.getInboundStatus()) || Integer.valueOf(1).equals(batch.getTraceGenerated())) {
            throw new BusinessException(400, "已入库或已生成溯源码的批次不能直接修改，请通过库存及质量业务处理");
        }
        applyBatch(batch, body);
        validateBatch(batch, tenantId);
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.updateById(batch);
        return batch;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteBatch(Long batchId, String tenantId) {
        HarvestBatch batch = lockBatch(batchId, tenantId);
        assertNoLinkedOffers(batchId, tenantId);
        if (!Integer.valueOf(0).equals(batch.getInboundStatus()) || Integer.valueOf(1).equals(batch.getTraceGenerated())) {
            throw new BusinessException(400, "已入库或已赋码的批次不能删除");
        }
        batchMapper.deleteById(batchId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HarvestBatch generateBatch(Long batchId, Map<String, Object> body, String tenantId) {
        HarvestBatch batch = lockBatch(batchId, tenantId);
        if (body != null && body.get("warehouseName") != null) {
            batch.setWarehouseName(str(body.get("warehouseName")));
        }
        var existingCodes = traceLifecycleService.listByBatch(String.valueOf(batch.getBatchId()), tenantId);
        String traceCode = existingCodes.isEmpty()
                ? traceLifecycleService.generate(String.valueOf(batch.getBatchId()), null, tenantId)
                : existingCodes.get(0).getCode();
        batch.setTraceCode(traceCode);
        batch.setTraceGenerated(1);
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.updateById(batch);
        // 契约要求这一步发布领域事件 prod.batch.harvested。按 2026-10-14 拍板的事件口径
        // （复用平台 core-infra 那套 outbox 契约）**落库为 NEW**，投递由 relay 负责 ——
        // 现在没有 relay，所以状态停在 NEW，不谎报"已发送"。
        domainEventService.batchHarvested(
                String.valueOf(batch.getBatchId()),
                batch.getBatchNo(),
                batch.getPlotId() == null ? null : String.valueOf(batch.getPlotId()),
                batch.getCropId() == null ? null : String.valueOf(batch.getCropId()),
                batch.getQuantity() == null ? null : batch.getQuantity().toPlainString(),
                batch.getUnit(),
                batch.getHarvestDate() == null ? null : batch.getHarvestDate().toString(),
                tenantId);
        return batch;
    }

    @Override
    public PageResult<InventoryFlow> pageBatchFlows(Long batchId, int pageNum, int pageSize, String tenantId) {
        return pageBatchFlows(batchId, pageNum, pageSize, tenantId, null, null, null, null, null, null, null);
    }

    @Override
    public PageResult<InventoryFlow> pageBatchFlows(Long batchId, int pageNum, int pageSize, String tenantId, Long inventoryId, Integer flowType, String direction, String startDate, String endDate, String operatorName, String keyword) {
        getOwnedBatch(batchId, tenantId);
        LambdaQueryWrapper<InventoryFlow> w = new LambdaQueryWrapper<>();
        w.eq(InventoryFlow::getTenantId, tenantId).eq(InventoryFlow::getBatchId, batchId);
        if (inventoryId != null) {
            Inventory inv = getOwnedInventory(inventoryId, tenantId);
            if (!batchId.equals(inv.getBatchId())) throw new BusinessException("库存与采收批次不一致");
            if (inv.getWarehouseName() == null) w.isNull(InventoryFlow::getWarehouseName);
            else w.eq(InventoryFlow::getWarehouseName, inv.getWarehouseName());
        }
        if (flowType != null) {
            if (flowType < 1 || flowType > 4) throw new BusinessException("流水类型无效");
            w.eq(InventoryFlow::getFlowType, flowType);
        }
        if (direction != null && !direction.isBlank()) {
            if ("in".equals(direction)) w.gt(InventoryFlow::getQuantity, BigDecimal.ZERO);
            else if ("out".equals(direction)) w.lt(InventoryFlow::getQuantity, BigDecimal.ZERO);
            else throw new BusinessException("流水方向无效");
        }
        LocalDate from = null, to = null;
        try {
            if (startDate != null && !startDate.isBlank()) from = LocalDate.parse(startDate);
            if (endDate != null && !endDate.isBlank()) to = LocalDate.parse(endDate);
        } catch (java.time.DateTimeException ex) { throw new BusinessException("流水日期格式应为 yyyy-MM-dd"); }
        if (from != null && to != null && from.isAfter(to)) throw new BusinessException("开始日期不能晚于结束日期");
        if (from != null) w.ge(InventoryFlow::getOperatedAt, from.atStartOfDay());
        if (to != null) w.lt(InventoryFlow::getOperatedAt, to.plusDays(1).atStartOfDay());
        if (operatorName != null && !operatorName.isBlank()) w.like(InventoryFlow::getOperatorName, operatorName.trim());
        if (keyword != null && !keyword.isBlank()) {
            String text = keyword.trim();
            w.and(q -> q.like(InventoryFlow::getOrderNo, text).or().like(InventoryFlow::getRemark, text));
        }
        w.orderByDesc(InventoryFlow::getOperatedAt).orderByDesc(InventoryFlow::getFlowId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 50;
        IPage<InventoryFlow> r = flowMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(r.getRecords(), r.getTotal(), p, s);
    }

    @Override
    public PageResult<Map<String, Object>> pagePlotHarvestRecords(Long plotId, int pageNum, int pageSize, String tenantId) {
        // 2026-10-16 取数口径修正：本端点原读**遗留表** agri_prod_harvest_record（实体 Harvest），
        // 而「新建采收」POST /harvests 写的是 agri_prod_harvest_batch —— 于是从「地块采收记录」页
        // 登记一条采收后，回本页（以及任何查本端点的页面）都查不到，看着像"没落库"。
        // 实测：/harvests 3 条（batch 表）与 /harvests/plan 1 条（record 表，2024-01-15）互不相干。
        // 现在统一读**写入侧那张表**，与 /harvests、/harvests/{id}、库存与溯源码同一数据源。
        LambdaQueryWrapper<HarvestBatch> w = new LambdaQueryWrapper<>();
        w.eq(HarvestBatch::getTenantId, tenantId);
        if (plotId != null) w.eq(HarvestBatch::getPlotId, plotId);
        w.orderByDesc(HarvestBatch::getHarvestDate).orderByDesc(HarvestBatch::getBatchId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<HarvestBatch> r = batchMapper.selectPage(new Page<>(p, s), w);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (HarvestBatch b : r.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            // recordId 保留旧名（前端既有契约），值就是批次主键；batchNo 另给，页面按批次编号展示。
            row.put("recordId", b.getBatchId());
            row.put("batchNo", b.getBatchNo());
            row.put("plotId", b.getPlotId());
            row.put("plotName", b.getPlotName());
            row.put("planId", b.getPlanId());
            row.put("cropId", b.getCropId());
            row.put("cropName", b.getCropName());
            row.put("cropVariety", b.getCropVariety());
            row.put("harvestDate", b.getHarvestDate());
            row.put("quantity", b.getQuantity());
            row.put("unit", b.getUnit());
            row.put("grade", b.getGrade());
            row.put("operatorId", b.getOperatorId());
            row.put("operatorName", b.getOperatorName());
            // 入库状态（0 待入库 / 1 已入库 / 2 已出库）与批次库存状态（1 在库 … 5 归档）
            // 是两个口径，都如实给出，前端按同一套字典展示，不在这一层做取舍。
            row.put("inboundStatus", b.getInboundStatus());
            row.put("status", b.getStatus());
            row.put("remark", b.getRemark());
            row.put("createdAt", b.getCreateTime());
            rows.add(row);
        }
        return PageResult.of(rows, r.getTotal(), p, s);
    }

    /* ==================== 成品库存 ==================== */

    @Override
    public PageResult<Inventory> pageInventory(int pageNum, int pageSize, String batchNo, String warehouseName,
                                              String category, String keyword, String healthStatus, String tenantId) {
        LambdaQueryWrapper<Inventory> w = new LambdaQueryWrapper<>();
        w.eq(Inventory::getTenantId, tenantId);
        if (batchNo != null && !batchNo.isBlank()) w.like(Inventory::getBatchNo, batchNo.trim());
        if (warehouseName != null && !warehouseName.isBlank()) w.eq(Inventory::getWarehouseName, warehouseName.trim());
        if (category != null && !category.isBlank()) w.eq(Inventory::getCategory, category.trim());
        if (keyword != null && !keyword.isBlank()) w.like(Inventory::getProductName, keyword.trim());
        w.orderByAsc(Inventory::getExpireDate).orderByAsc(Inventory::getInventoryId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<Inventory> r = inventoryMapper.selectPage(new Page<>(p, s), w);
        List<Inventory> list = new ArrayList<>(r.getRecords());
        list.forEach(this::fillHealth);
        if (healthStatus != null && !healthStatus.isBlank()) {
            // 健康状态是派生量（库里没有这一列），过滤只能在这里做
            List<Inventory> filtered = list.stream().filter(i -> healthStatus.equals(i.getHealthStatus())).toList();
            return PageResult.of(filtered, (long) filtered.size(), p, s);
        }
        return PageResult.of(list, r.getTotal(), p, s);
    }

    @Override
    public Inventory detailInventory(Long inventoryId, String tenantId) {
        Inventory inv = getOwnedInventory(inventoryId, tenantId);
        fillHealth(inv);
        return inv;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inventory createInventory(Map<String, Object> body, String tenantId) {
        Long batchId = toLong(body.get("batchId"));
        BigDecimal quantity = requirePositive(dec(body.get("currentQty")), "入库数量必须大于 0");
        String warehouse = str(body.get("warehouseName"));
        if (warehouse == null) throw new BusinessException(400, "仓库名称不能为空");
        Map<String, Object> entry = new LinkedHashMap<>(body);
        entry.put("quantity", quantity);
        stockIn(entry, tenantId);
        Inventory inv = inventoryOfWarehouse(batchId, warehouse, tenantId);
        if (body.containsKey("safeQty")) inv.setSafeQty(dec(body.get("safeQty")));
        if (body.containsKey("remark")) inv.setRemark(str(body.get("remark")));
        inventoryMapper.updateById(inv);
        fillHealth(inv);
        return inv;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inventory updateInventory(Long inventoryId, Map<String, Object> body, String tenantId) {
        Inventory inv = getOwnedInventory(inventoryId, tenantId);
        lockBatch(inv.getBatchId(), tenantId);
        inv = getOwnedInventory(inventoryId, tenantId);
        for (String key : List.of("batchId", "batchNo", "warehouseName", "unit", "currentQty", "frozenQty")) {
            if (!body.containsKey(key)) continue;
            Object old = switch (key) {
                case "batchId" -> inv.getBatchId();
                case "batchNo" -> inv.getBatchNo();
                case "warehouseName" -> inv.getWarehouseName();
                case "unit" -> inv.getUnit();
                case "currentQty" -> inv.getCurrentQty();
                default -> inv.getFrozenQty();
            };
            Object next = body.get(key);
            boolean same = old instanceof BigDecimal && next != null
                    ? ((BigDecimal) old).compareTo(dec(next)) == 0
                    : java.util.Objects.equals(old == null ? null : old.toString(), next == null ? null : next.toString());
            if (!same) throw new BusinessException(400, "批次、仓库、单位及库存余额不能直接改写，请使用库存业务操作");
        }
        applyInventory(inv, body);
        inv.setUpdateTime(LocalDateTime.now());
        inventoryMapper.updateById(inv);
        fillHealth(inv);
        return inv;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteInventory(Long inventoryId, String tenantId) {
        Inventory inv = getOwnedInventory(inventoryId, tenantId);
        lockBatch(inv.getBatchId(), tenantId);
        if (flowMapper.selectCount(new LambdaQueryWrapper<InventoryFlow>()
                .eq(InventoryFlow::getTenantId, tenantId).eq(InventoryFlow::getBatchId, inv.getBatchId())) > 0)
            throw new BusinessException(400, "已有库存流水的记录不能删除，须保留对账记录");
        if (inv.getCurrentQty() != null && inv.getCurrentQty().signum() != 0)
            throw new BusinessException(400, "库存余额不为零，不能删除");
        inventoryMapper.deleteById(inventoryId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean stockIn(Map<String, Object> body, String tenantId) {
        Long batchId = toLong(body.get("batchId"));
        if (batchId == null) throw new BusinessException(400, "缺少 batchId");
        BigDecimal qty = requirePositive(dec(body.get("quantity")), "入库数量必须大于 0");
        HarvestBatch batch = lockBatch(batchId, tenantId);
        BigDecimal entered = flowMapper.selectList(new LambdaQueryWrapper<InventoryFlow>()
                .eq(InventoryFlow::getTenantId, tenantId).eq(InventoryFlow::getBatchId, batchId)
                .eq(InventoryFlow::getFlowType, 1)).stream()
                .map(InventoryFlow::getQuantity).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (batch.getQuantity() == null || entered.add(qty).compareTo(batch.getQuantity()) > 0)
            throw new BusinessException(400, "累计入库数量不能超过采收数量");
        if (str(body.get("unit")) != null && !java.util.Objects.equals(batch.getUnit(), str(body.get("unit"))))
            throw new BusinessException(400, "入库单位必须与采收批次一致");
        String warehouse = str(body.get("warehouseName"));
        if (warehouse == null) warehouse = "主仓库";

        Inventory inv = inventoryOfWarehouse(batchId, warehouse, tenantId);
        if (inv == null) {
            inv = new Inventory();
            inv.setTenantId(tenantId);
            inv.setBatchId(batchId);
            inv.setBatchNo(batch.getBatchNo());
            inv.setWarehouseName(warehouse);
            inv.setCurrentQty(BigDecimal.ZERO);
            inv.setFrozenQty(BigDecimal.ZERO);
            inv.setLossQty(BigDecimal.ZERO);
            inv.setFrozen(0);
            inv.setUnit(batch.getUnit());
            inv.setGrade(batch.getGrade());
            inv.setCategory(batch.getCropName());
            inv.setProductName(batch.getCropName() == null ? null
                    : batch.getCropName() + "(" + (batch.getGrade() == null ? "-" : batch.getGrade()) + "级)");
            inv.setCreateTime(LocalDateTime.now());
            inv.setDeleted(0);
        }
        if (str(body.get("unit")) != null) inv.setUnit(str(body.get("unit")));
        if (str(body.get("locationCode")) != null) inv.setLocationCode(str(body.get("locationCode")));
        if (str(body.get("expireDate")) != null) inv.setExpireDate(parseDate(str(body.get("expireDate"))));
        inv.setCurrentQty(inv.getCurrentQty().add(qty));
        if (Integer.valueOf(1).equals(inv.getFrozen())) inv.setFrozenQty(inv.getCurrentQty());
        inv.setLastInAt(LocalDateTime.now());
        inv.setUpdateTime(LocalDateTime.now());
        if (inv.getInventoryId() == null) inventoryMapper.insert(inv);
        else inventoryMapper.updateById(inv);

        writeFlow(batchId, 1, qty, inv.getUnit(), warehouse, str(body.get("operatorName")), null,
                "采收入库", tenantId);

        // 批次的入库状态由库存动作推导，不让人手工填（手工填会出现"库存有货但批次写着待入库"）
        refreshBatchStock(batch);
        batch.setWarehouseName(warehouse);
        batch.setInventoryId(inv.getInventoryId());
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.updateById(batch);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InventoryFlow stockOut(Long batchId, BigDecimal qty, String relatedOrderNo,
                                  String operatorName, Long inventoryId, String tenantId) {
        if (batchId == null) throw new BusinessException(400, "缺少 batchId");
        requirePositive(qty, "出库数量必须大于 0");
        lockBatch(batchId, tenantId);
        Inventory inv = sourceInventory(batchId, inventoryId, tenantId);
        if (inv == null) throw new BusinessException(400, "该批次还没有入库记录，无法出库");
        if (Integer.valueOf(1).equals(inv.getFrozen()) ||
                inv.getCurrentQty().subtract(inv.getFrozenQty() == null ? BigDecimal.ZERO : inv.getFrozenQty()).compareTo(qty) < 0) {
            throw new BusinessException(400, "可用库存不足或库存已冻结");
        }
        if (inv.getCurrentQty().compareTo(qty) < 0) {
            throw new BusinessException(400, String.format("库存不足：当前 %s %s，本次出库 %s",
                    inv.getCurrentQty().stripTrailingZeros().toPlainString(),
                    inv.getUnit() == null ? "" : inv.getUnit(),
                    qty.stripTrailingZeros().toPlainString()));
        }
        inv.setCurrentQty(inv.getCurrentQty().subtract(qty));
        inv.setLastOutAt(LocalDateTime.now());
        inv.setUpdateTime(LocalDateTime.now());
        inventoryMapper.updateById(inv);

        InventoryFlow flow = writeFlow(batchId, 2, qty.negate(), inv.getUnit(), inv.getWarehouseName(),
                operatorName, relatedOrderNo, "销售出库", tenantId);

        HarvestBatch batch = getOwnedBatch(batchId, tenantId);
        refreshBatchStock(batch);
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.updateById(batch);
        return flow;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HarvestBatch freeze(Long batchId, Long inventoryId, boolean frozen, String tenantId) {
        HarvestBatch batch = lockBatch(batchId, tenantId);
        Inventory inv = sourceInventory(batchId, inventoryId, tenantId);
        if (inv == null) throw new BusinessException(400, "该批次还没有入库记录，无法冻结");
        inv.setFrozen(frozen ? 1 : 0);
        inv.setFrozenQty(frozen ? inv.getCurrentQty() : BigDecimal.ZERO);
        inv.setUpdateTime(LocalDateTime.now());
        inventoryMapper.updateById(inv);
        refreshBatchStock(batch);
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.updateById(batch);
        return batch;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean registerLoss(Long batchId, Map<String, Object> body, String tenantId) {
        lockBatch(batchId, tenantId);
        BigDecimal qty = requirePositive(dec(body.get("quantity")), "损耗数量必须大于 0");
        String reason = str(body.get("reason"));
        if (reason == null) throw new BusinessException(400, "损耗原因不能为空");
        Inventory inv = sourceInventory(batchId, idOf(body.get("inventoryId")), tenantId);
        if (inv == null) throw new BusinessException(400, "该批次还没有入库记录，无法登记损耗");
        if (Integer.valueOf(1).equals(inv.getFrozen()) ||
                inv.getCurrentQty().subtract(inv.getFrozenQty() == null ? BigDecimal.ZERO : inv.getFrozenQty()).compareTo(qty) < 0) {
            throw new BusinessException(400, "可用库存不足或库存已冻结");
        }
        if (inv.getCurrentQty().compareTo(qty) < 0) {
            throw new BusinessException(400, String.format("库存不足：当前 %s，本次损耗 %s",
                    inv.getCurrentQty().stripTrailingZeros().toPlainString(),
                    qty.stripTrailingZeros().toPlainString()));
        }
        inv.setCurrentQty(inv.getCurrentQty().subtract(qty));
        inv.setLossQty((inv.getLossQty() == null ? BigDecimal.ZERO : inv.getLossQty()).add(qty));
        inv.setLossReason(reason);
        inv.setUpdateTime(LocalDateTime.now());
        inventoryMapper.updateById(inv);
        writeFlow(batchId, 4, qty.negate(), inv.getUnit(), inv.getWarehouseName(),
                str(body.get("operatorName")), null, reason, tenantId);
        HarvestBatch batch = getOwnedBatch(batchId, tenantId);
        refreshBatchStock(batch);
        batchMapper.updateById(batch);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean transfer(Long batchId, Map<String, Object> body, String tenantId) {
        lockBatch(batchId, tenantId);
        String target = str(body.get("targetWarehouse"));
        if (target == null) throw new BusinessException(400, "目标仓库不能为空");
        BigDecimal qty = requirePositive(dec(body.get("quantity")), "调拨数量必须大于 0");
        Inventory source = sourceInventory(batchId, idOf(body.get("inventoryId")), tenantId);
        if (source == null) throw new BusinessException(400, "该批次还没有入库记录，无法调拨");
        if (target.equals(source.getWarehouseName())) {
            throw new BusinessException(400, "目标仓库与当前仓库相同，无需调拨");
        }
        if (Integer.valueOf(1).equals(source.getFrozen()) ||
                source.getCurrentQty().subtract(source.getFrozenQty() == null ? BigDecimal.ZERO : source.getFrozenQty()).compareTo(qty) < 0) {
            throw new BusinessException(400, String.format("库存不足：当前 %s，本次调拨 %s",
                    source.getCurrentQty().stripTrailingZeros().toPlainString(),
                    qty.stripTrailingZeros().toPlainString()));
        }
        source.setCurrentQty(source.getCurrentQty().subtract(qty));
        source.setUpdateTime(LocalDateTime.now());
        inventoryMapper.updateById(source);

        Inventory targetRow = inventoryOfWarehouse(batchId, target, tenantId);
        if (targetRow == null) {
            targetRow = new Inventory();
            targetRow.setTenantId(tenantId);
            targetRow.setBatchId(batchId);
            targetRow.setBatchNo(source.getBatchNo());
            targetRow.setWarehouseName(target);
            targetRow.setCurrentQty(BigDecimal.ZERO);
            targetRow.setFrozenQty(BigDecimal.ZERO);
            targetRow.setLossQty(BigDecimal.ZERO);
            targetRow.setFrozen(0);
            targetRow.setUnit(source.getUnit());
            targetRow.setGrade(source.getGrade());
            targetRow.setCategory(source.getCategory());
            targetRow.setExpireDate(source.getExpireDate());
            targetRow.setProductName(source.getProductName());
            targetRow.setCreateTime(LocalDateTime.now());
            targetRow.setDeleted(0);
        }
        if (Integer.valueOf(1).equals(targetRow.getFrozen()))
            throw new BusinessException(400, "目标仓库库存已冻结，不能调入");
        if (str(body.get("locationCode")) != null) targetRow.setLocationCode(str(body.get("locationCode")));
        targetRow.setCurrentQty(targetRow.getCurrentQty().add(qty));
        targetRow.setLastInAt(LocalDateTime.now());
        targetRow.setUpdateTime(LocalDateTime.now());
        if (targetRow.getInventoryId() == null) inventoryMapper.insert(targetRow);
        else inventoryMapper.updateById(targetRow);

        writeFlow(batchId, 3, qty.negate(), source.getUnit(), source.getWarehouseName(),
                str(body.get("operatorName")), null, "调拨至 " + target, tenantId);
        writeFlow(batchId, 3, qty, source.getUnit(), target,
                str(body.get("operatorName")), null, "调拨自 " + source.getWarehouseName(), tenantId);
        return true;
    }

    @Override
    public List<Inventory> inventoryByBatch(Long batchId, String tenantId) {
        return inventoryMapper.selectList(new LambdaQueryWrapper<Inventory>()
                .eq(Inventory::getTenantId, tenantId).eq(Inventory::getBatchId, batchId));
    }

    /* ==================== 内部工具 ==================== */

    private HarvestBatch lockBatch(Long batchId, String tenantId) {
        HarvestBatch batch = batchMapper.lockOwned(batchId, tenantId);
        if (batch == null) throw new BusinessException(404, "采收批次不存在或不属于当前主体");
        return batch;
    }

    private void validateBatch(HarvestBatch batch, String tenantId) {
        Plot plot = batch.getPlotId() == null ? null : plotMapper.selectById(batch.getPlotId());
        if (plot == null || !java.util.Objects.equals(tenantId, plot.getTenantId()))
            throw new BusinessException(404, "采收地块不存在或不属于当前主体");
        if (batch.getFarmId() != null && !java.util.Objects.equals(batch.getFarmId(), plot.getFarmId()))
            throw new BusinessException(400, "采收农场与地块所属农场不一致");
        requirePositive(batch.getQuantity(), "采收数量必须大于 0");
        batch.setFarmId(plot.getFarmId());
        batch.setPlotName(plot.getPlotName());
        if (batch.getCropName() == null) batch.setCropName(plot.getCurrentCrop());
    }

    private void assertNoLinkedOffers(Long batchId, String tenantId) {
        // 锁定读避免 REPEATABLE READ 旧快照漏掉并发刚提交的供给。关闭/驳回也保留来源关系。
        if (!offerMapper.lockBatchOfferIds(batchId, tenantId).isEmpty()) {
            throw new BusinessException(400, "采收批次已关联供给单，不能直接修改或删除；请在产销对接中核对关联供给，保留历史采收来源");
        }
    }

    private HarvestBatch getOwnedBatch(Long batchId, String tenantId) {
        HarvestBatch batch = batchMapper.selectById(batchId);
        if (batch == null || !tenantId.equals(batch.getTenantId())) {
            throw new BusinessException(404, "采收批次不存在：" + batchId);
        }
        return batch;
    }

    private Inventory getOwnedInventory(Long inventoryId, String tenantId) {
        Inventory inv = inventoryMapper.selectById(inventoryId);
        if (inv == null || !tenantId.equals(inv.getTenantId())) {
            throw new BusinessException(404, "库存记录不存在：" + inventoryId);
        }
        return inv;
    }

    private Long idOf(Object value) {
        if (value == null) return null;
        try { return Long.valueOf(String.valueOf(value)); }
        catch (NumberFormatException ex) { throw new BusinessException(400, "库存编号无效"); }
    }

    private Inventory sourceInventory(Long batchId, Long inventoryId, String tenantId) {
        if (inventoryId != null) {
            Inventory row = getOwnedInventory(inventoryId, tenantId);
            if (!java.util.Objects.equals(row.getBatchId(), batchId))
                throw new BusinessException(400, "库存记录与采收批次不一致");
            return row;
        }
        List<Inventory> rows = inventoryByBatch(batchId, tenantId);
        if (rows.size() > 1) throw new BusinessException(400, "该批次有多个仓库，请指定库存编号");
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void refreshBatchStock(HarvestBatch batch) {
        List<Inventory> rows = inventoryByBatch(batch.getBatchId(), batch.getTenantId());
        BigDecimal total = rows.stream().map(Inventory::getCurrentQty)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean allFrozen = rows.stream().filter(x -> x.getCurrentQty().signum() > 0)
                .allMatch(x -> Integer.valueOf(1).equals(x.getFrozen()));
        batch.setInboundStatus(total.signum() > 0 ? 1 : 2);
        batch.setStatus(total.signum() == 0 ? 3 : allFrozen ? 4 : 1);
        batch.setUpdateTime(LocalDateTime.now());
    }

    private Inventory inventoryOfWarehouse(Long batchId, String warehouse, String tenantId) {
        return inventoryMapper.selectOne(new LambdaQueryWrapper<Inventory>()
                .eq(Inventory::getTenantId, tenantId).eq(Inventory::getBatchId, batchId)
                .eq(Inventory::getWarehouseName, warehouse).last("LIMIT 1"));
    }

    /** 写一条库存流水 —— 这是"流水加总 = 当前库存"唯一能对上的凭据。 */
    private InventoryFlow writeFlow(Long batchId, int flowType, BigDecimal signedQty, String unit,
                                    String warehouseName, String operatorName, String orderNo,
                                    String remark, String tenantId) {
        InventoryFlow flow = new InventoryFlow();
        flow.setBatchId(batchId);
        flow.setFlowType(flowType);
        flow.setQuantity(signedQty);
        flow.setUnit(unit);
        flow.setWarehouseName(warehouseName);
        flow.setOperatorName(operatorName);
        flow.setOrderNo(orderNo);
        flow.setRemark(remark);
        flow.setOperatedAt(LocalDateTime.now());
        flow.setTenantId(tenantId);
        flow.setCreateTime(LocalDateTime.now());
        flow.setUpdateTime(LocalDateTime.now());
        flow.setDeleted(0);
        flowMapper.insert(flow);
        return flow;
    }

    /** 健康状态：先看是否低于安全库存（shortage），再看是否临期（expiring），否则 normal。 */
    private void fillHealth(Inventory inv) {
        inv.setFrozenFlag(inv.getFrozen() != null && inv.getFrozen() == 1);
        if (inv.getSafeQty() != null && inv.getCurrentQty() != null
                && inv.getCurrentQty().compareTo(inv.getSafeQty()) <= 0) {
            inv.setHealthStatus("shortage");
            return;
        }
        if (inv.getExpireDate() != null
                && !inv.getExpireDate().isAfter(LocalDate.now().plusDays(EXPIRING_DAYS))) {
            inv.setHealthStatus("expiring");
            return;
        }
        inv.setHealthStatus("normal");
    }

    private void applyBatch(HarvestBatch b, Map<String, Object> body) {
        if (body == null) return;
        set(body, "batchNo", v -> b.setBatchNo(str(v)));
        set(body, "plotId", v -> b.setPlotId(toLong(v)));
        set(body, "plotName", v -> b.setPlotName(str(v)));
        set(body, "planId", v -> b.setPlanId(toLong(v)));
        set(body, "cropId", v -> b.setCropId(toLong(v)));
        set(body, "cropName", v -> b.setCropName(str(v)));
        set(body, "cropVariety", v -> b.setCropVariety(str(v)));
        set(body, "harvestDate", v -> b.setHarvestDate(parseDate(str(v))));
        set(body, "quantity", v -> b.setQuantity(dec(v)));
        set(body, "unit", v -> b.setUnit(str(v)));
        set(body, "grade", v -> b.setGrade(str(v)));
        set(body, "operatorId", v -> b.setOperatorId(toLong(v)));
        set(body, "operatorName", v -> b.setOperatorName(str(v)));
        set(body, "status", v -> b.setStatus(toInt(v)));
        set(body, "farmId", v -> b.setFarmId(toLong(v)));
        set(body, "farmName", v -> b.setFarmName(str(v)));
        set(body, "harvestArea", v -> b.setHarvestArea(dec(v)));
        set(body, "appearance", v -> b.setAppearance(str(v)));
        set(body, "expectedQuantity", v -> b.setExpectedQuantity(dec(v)));
        set(body, "perMuYield", v -> b.setPerMuYield(dec(v)));
        set(body, "relatedTaskId", v -> b.setRelatedTaskId(toLong(v)));
        set(body, "relatedTaskName", v -> b.setRelatedTaskName(str(v)));
        set(body, "warehouseName", v -> b.setWarehouseName(str(v)));
        set(body, "remark", v -> b.setRemark(str(v)));
    }

    private void applyInventory(Inventory inv, Map<String, Object> body) {
        if (body == null) return;
        set(body, "batchId", v -> inv.setBatchId(toLong(v)));
        set(body, "batchNo", v -> inv.setBatchNo(str(v)));
        set(body, "warehouseName", v -> inv.setWarehouseName(str(v)));
        set(body, "currentQty", v -> inv.setCurrentQty(dec(v)));
        set(body, "unit", v -> inv.setUnit(str(v)));
        set(body, "frozenQty", v -> inv.setFrozenQty(dec(v)));
        set(body, "locationCode", v -> inv.setLocationCode(str(v)));
        set(body, "productName", v -> inv.setProductName(str(v)));
        set(body, "category", v -> inv.setCategory(str(v)));
        set(body, "grade", v -> inv.setGrade(str(v)));
        set(body, "safeQty", v -> inv.setSafeQty(dec(v)));
        set(body, "expireDate", v -> inv.setExpireDate(parseDate(str(v))));
        set(body, "relatedBatchNo", v -> inv.setRelatedBatchNo(str(v)));
        set(body, "remark", v -> inv.setRemark(str(v)));
    }

    private static void set(Map<String, Object> body, String key, Consumer<Object> setter) {
        if (body.containsKey(key)) setter.accept(body.get(key));
    }

    private String nextBatchNo(String tenantId) {
        String day = LocalDate.now().format(DAY);
        for (int i = 0; i < 8; i++) {
            String no = "H" + day + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = batchMapper.selectCount(new LambdaQueryWrapper<HarvestBatch>()
                    .eq(HarvestBatch::getTenantId, tenantId).eq(HarvestBatch::getBatchNo, no));
            if (used == null || used == 0) return no;
        }
        throw new BusinessException(500, "生成批次号失败，请稍后重试");
    }

    private String nextTraceCode(HarvestBatch batch) {
        String day = LocalDate.now().format(DAY);
        return "AG" + (batch.getPlotId() == null ? "00" : String.format("%02d", batch.getPlotId()))
                + day + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private static BigDecimal requirePositive(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) throw new BusinessException(400, message);
        return value;
    }

    private static LocalDate parseDate(String value) {
        String text = str(value);
        if (text == null) return null;
        try {
            return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text);
        } catch (RuntimeException e) {
            throw new BusinessException(400, "日期格式不正确：" + value + "（应为 yyyy-MM-dd）");
        }
    }

    private static String str(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Long toLong(Object value) {
        String text = str(value);
        if (text == null) return null;
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer toInt(Object value) {
        Long v = toLong(value);
        return v == null ? null : v.intValue();
    }

    private static BigDecimal dec(Object value) {
        String text = str(value);
        if (text == null) return null;
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "数量格式不正确：" + text);
        }
    }
}
