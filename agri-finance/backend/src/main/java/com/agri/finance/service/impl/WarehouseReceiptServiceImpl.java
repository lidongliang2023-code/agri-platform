package com.agri.finance.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.PledgeGoods;
import com.agri.finance.entity.PledgeMonitor;
import com.agri.finance.entity.WarehouseReceipt;
import com.agri.finance.mapper.WarehouseReceiptMapper;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.ProductionWarehouseClient;
import com.agri.finance.service.ProductionWarehouseClient.AlertView;
import com.agri.finance.service.ProductionWarehouseClient.BatchView;
import com.agri.finance.service.ProductionWarehouseClient.ChainView;
import com.agri.finance.service.ProductionWarehouseClient.DeviceView;
import com.agri.finance.service.ProductionWarehouseClient.InventoryView;
import com.agri.finance.service.ProductionWarehouseClient.SensorView;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 仓单（仓单链路的起点）。
 *
 * <p>口径：仓单<b>不是</b>融资方填的一张表单，而是<b>生产域一个已入库采收批次</b>在金融侧的凭据。
 * 品类、数量、单位、仓库、溯源码、区块链存证一律从生产域读，金融侧只补两件金融才有的事：
 * 质押物字典编码（决定折算率上限）和单价（估值口径）。原来"手填质押物类型+数量+单价"
 * 的做法没有任何东西可以对账，仓单和真实库存能差出一整批货。</p>
 *
 * <p>状态机：{@code 待质押 → 已质押 → 已释放}。一个批次同时只能有一张未释放的仓单 ——
 * 否则同一批货能开两张仓单、质押两次，这是仓单融资最典型的重复担保。</p>
 */
@Slf4j
@Service
public class WarehouseReceiptServiceImpl extends ServiceImpl<WarehouseReceiptMapper, WarehouseReceipt> {

    public static final String TO_PLEDGE = "待质押";
    public static final String PLEDGED = "已质押";
    public static final String RELEASED = "已释放";

    private final ProductionWarehouseClient productionClient;
    private final PledgeGoodsServiceImpl pledgeGoodsService;
    private final PledgeMonitorServiceImpl monitorService;
    private final FinanceIdentityService identityService;

    public WarehouseReceiptServiceImpl(ProductionWarehouseClient productionClient,
                                       PledgeGoodsServiceImpl pledgeGoodsService,
                                       PledgeMonitorServiceImpl monitorService,
                                       FinanceIdentityService identityService) {
        this.productionClient = productionClient;
        this.pledgeGoodsService = pledgeGoodsService;
        this.monitorService = monitorService;
        this.identityService = identityService;
    }

    /**
     * 可开仓单的批次：当前主体已入库的采收批次 + 金融侧已有的仓单状态。
     *
     * <p>批次来自生产域（按调用方令牌解析租户），金融侧不另存一份库存台账；
     * 这里只把"这个批次开过仓单没有"补上，页面才不会让人对同一批货重复申请。</p>
     */
    public List<Map<String, Object>> candidateBatches() {
        String borrowerId = identityService.currentBorrowerId();
        List<BatchView> batches = productionClient.inboundBatches();
        Map<String, WarehouseReceipt> byBatch = new LinkedHashMap<>();
        for (WarehouseReceipt receipt : lambdaQuery()
                .eq(WarehouseReceipt::getUserId, borrowerId)
                .eq(WarehouseReceipt::getDelFlag, 0)
                .orderByDesc(WarehouseReceipt::getCreatedAt)
                .list()) {
            // 同一批次历史上可能有已释放的旧仓单，展示用的是还没释放的那张
            if (receipt.getBatchNo() != null && !byBatch.containsKey(receipt.getBatchNo())) {
                byBatch.put(receipt.getBatchNo(), receipt);
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (BatchView batch : batches) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("batchId", batch.batchId());
            row.put("batchNo", batch.batchNo());
            row.put("cropName", batch.cropName());
            row.put("cropVariety", batch.cropVariety());
            row.put("grade", batch.grade());
            row.put("quantity", batch.quantity());
            row.put("unit", batch.unit());
            row.put("warehouseName", batch.warehouseName());
            row.put("traceCode", batch.traceCode());
            row.put("harvestDate", batch.harvestDate());
            WarehouseReceipt receipt = byBatch.get(batch.batchNo());
            row.put("receiptId", receipt == null ? null : receipt.getId());
            row.put("receiptNo", receipt == null ? null : receipt.getReceiptNo());
            row.put("receiptStatus", receipt == null ? null : receipt.getStatus());
            rows.add(row);
        }
        return rows;
    }

    /** 开单前的核对页：批次详情 + 分仓库存 + 在库可用量 + 存证状态。 */
    public Map<String, Object> batchPreview(String batchId) {
        BatchView batch = requireBatch(batchId);
        List<InventoryView> inventories = productionClient.inventory(batch.batchNo());
        BigDecimal available = availableQuantity(inventories);
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("batch", batch);
        preview.put("inventories", inventories);
        preview.put("availableQuantity", available);
        preview.put("chain", productionClient.harvestChainRecord(batch.batchNo()));
        preview.put("receipt", unreleasedOf(batch.userId(), batch.batchNo()));
        return preview;
    }

    /**
     * 按批次生成仓单。
     *
     * <p>校验顺序是按"错的代价"排的：先身份与批次归属（错了会把别人的货变成自己的担保），
     * 再重复开单（同一批货二次担保），再库存量（虚报数量），最后才是字典与价格。</p>
     */
    @Transactional
    public WarehouseReceipt createFromBatch(Map<String, Object> form) {
        String borrowerId = identityService.currentBorrowerId();
        String batchId = text(form.get("batchId"));
        if (batchId == null) {
            throw new BusinessException(400, "请选择要开仓单的采收批次");
        }
        BatchView batch = requireBatch(batchId);
        if (!borrowerId.equals(batch.userId())) {
            throw new BusinessException(403, "采收批次「" + batch.batchNo() + "」不属于当前融资主体（生产域租户 "
                    + batch.userId() + "），不能开成你的仓单");
        }
        if (!Integer.valueOf(1).equals(batch.inboundStatus())) {
            throw new BusinessException(409, "采收批次「" + batch.batchNo() + "」还没有完成成品入库，"
                    + "没有入库就没有仓单，请先在生产管理模块做完入库");
        }
        WarehouseReceipt existing = unreleasedOf(borrowerId, batch.batchNo());
        if (existing != null) {
            throw new BusinessException(409, "批次 " + batch.batchNo() + " 已有仓单 "
                    + existing.getReceiptNo() + "（状态：" + existing.getStatus()
                    + "），同一批货不能重复开仓单质押");
        }
        BigDecimal available = availableQuantity(productionClient.inventory(batch.batchNo()));
        if (available.signum() <= 0) {
            throw new BusinessException(409, "批次 " + batch.batchNo()
                    + " 在库可用量为 0（已全部出库或被冻结），不能开仓单");
        }
        PledgeGoods goods = requireEnabledGoods(text(form.get("goodsCode")));
        BigDecimal quantity = decimal(form.get("quantity"), batch.quantity());
        if (quantity == null || quantity.signum() <= 0) {
            throw new BusinessException(400, "质押数量必须大于 0");
        }
        if (quantity.compareTo(available) > 0) {
            throw new BusinessException(400, "质押数量 " + quantity.stripTrailingZeros().toPlainString() + " "
                    + batch.unit() + " 超过该批次在库可用量 " + available.stripTrailingZeros().toPlainString()
                    + " " + batch.unit() + "（出库与冻结的部分不能算进仓单）");
        }
        BigDecimal unitPrice = decimal(form.get("unitPrice"), null);
        if (unitPrice == null || unitPrice.signum() <= 0) {
            throw new BusinessException(400, "请填写货物单价（元/" + batch.unit() + "），仓单价值按数量×单价计算");
        }
        ChainView chain = productionClient.harvestChainRecord(batch.batchNo());
        if (chain == null) {
            log.info("批次 {} 尚无成功上链的存证，仓单先开出来，质押审核时再核对", batch.batchNo());
        }

        WarehouseReceipt receipt = new WarehouseReceipt();
        receipt.setReceiptNo("WR" + System.currentTimeMillis());
        receipt.setUserId(borrowerId);
        receipt.setBatchId(batch.batchId());
        receipt.setBatchNo(batch.batchNo());
        receipt.setGoodsCode(goods.getGoodsCode());
        receipt.setFarmId(batch.farmId());
        receipt.setPlotId(batch.plotId());
        receipt.setTraceCode(batch.traceCode());
        receipt.setCommodityType(goods.getGoodsName());
        receipt.setQualityStandard(batch.grade() == null ? goods.getQualityStandard() : batch.grade());
        receipt.setQuantity(quantity);
        receipt.setUnit(batch.unit());
        receipt.setUnitPrice(unitPrice);
        receipt.setTotalValue(quantity.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP));
        receipt.setStatus(TO_PLEDGE);
        receipt.setWarehouseName(textOr(form.get("warehouseName"), batch.warehouseName()));
        receipt.setLocation(textOr(form.get("location"), batch.plotName()));
        receipt.setBlockchainHash(chain == null ? null : chain.txHash());
        LocalDateTime now = LocalDateTime.now();
        receipt.setIssueDate(now);
        Integer term = goods.getMaxPledgeTerm();
        // 字典里的最长期限按天理解；仓单过期后不能再质押（生产侧的货会先出库）
        receipt.setExpireDate(term == null || term <= 0 ? now.plusDays(180) : now.plusDays(term));
        receipt.setDelFlag(0);
        receipt.setCreatedAt(now);
        receipt.setUpdatedAt(now);
        save(receipt);
        return receipt;
    }

    /** 质押生效时占用仓单：待质押 → 已质押，并把质押单号写回仓单。 */
    @Transactional
    public WarehouseReceipt markPledged(String receiptId, String pledgeId) {
        WarehouseReceipt receipt = getById(receiptId);
        if (receipt == null || Integer.valueOf(1).equals(receipt.getDelFlag())) {
            throw new BusinessException(404, "仓单不存在");
        }
        if (!TO_PLEDGE.equals(receipt.getStatus())) {
            throw new BusinessException(409, "仓单 " + receipt.getReceiptNo() + " 当前状态「"
                    + receipt.getStatus() + "」不能再次质押");
        }
        if (receipt.getExpireDate() != null && receipt.getExpireDate().isBefore(LocalDateTime.now())) {
            throw new BusinessException(409, "仓单 " + receipt.getReceiptNo() + " 已于 "
                    + receipt.getExpireDate() + " 过期，请先与仓库确认续期后再质押");
        }
        receipt.setStatus(PLEDGED);
        receipt.setPledgeId(pledgeId);
        receipt.setUpdatedAt(LocalDateTime.now());
        updateById(receipt);
        return receipt;
    }

    /** 质押释放时放行仓单：已质押 → 已释放（未质押的仓单本来就可以改，不做状态跳转）。 */
    @Transactional
    public void releaseByReceiptId(String receiptId, String reason) {
        WarehouseReceipt receipt = getById(receiptId);
        if (receipt == null || RELEASED.equals(receipt.getStatus())) {
            return;
        }
        receipt.setStatus(RELEASED);
        receipt.setUpdatedAt(LocalDateTime.now());
        updateById(receipt);
        log.info("仓单 {} 已释放：{}", receipt.getReceiptNo(), reason);
    }

    /** 最近一次仓储读数快照（没有就读到 null，页面按"暂无监控"显示）。 */
    public PledgeMonitor latestMonitor(String receiptId) {
        return monitorService.getLatestMonitor(receiptId);
    }

    /**
     * 拉一次生产域读数并存成快照。
     *
     * <p>重量与气体浓度本部署没有采集通道（生产域只有温湿度/土壤/光照等传感器），
     * 存 null 而不是编一个数 —— 页面显示"—"是"这个传感器没装"，显示 0 会被当成"货不见了"。</p>
     *
     * <p>读数出处一并存下来：优先取本批次地块/农场名下的设备，一处都取不到时才退到主体名下其它设备，
     * 并在 {@code deviceNote} 里写明"这不是该批次的仓储通道"。不加这层出处，页面上的温度
     * 就成了不知道属于谁的数字。</p>
     */
    @Transactional
    public PledgeMonitor refreshMonitor(String receiptId) {
        WarehouseReceipt receipt = getById(receiptId);
        if (receipt == null || Integer.valueOf(1).equals(receipt.getDelFlag())) {
            throw new BusinessException(404, "仓单不存在");
        }
        identityService.assertBorrowerOwns(receipt.getUserId());
        List<DeviceView> scoped = productionClient.devices(receipt.getFarmId(), receipt.getPlotId());
        List<SensorView> readings = productionClient.latestSensors(idsOf(scoped));
        List<DeviceView> pool = scoped;
        String note;
        if (!readings.isEmpty()) {
            note = "读数来自本批次地块/农场名下的设备";
        } else {
            List<DeviceView> all = productionClient.allDevices();
            readings = productionClient.latestSensors(idsOf(all));
            pool = all;
            note = readings.isEmpty()
                    ? "生产域当前没有可用读数（设备离线或本部署未接入传感器）"
                    : "本批次地块/农场没有绑定在线传感器，读数取自主体名下其它设备，不是该批次的仓储冷链通道";
        }
        PledgeMonitor monitor = new PledgeMonitor();
        monitor.setReceiptId(receipt.getId());
        monitor.setReceiptNo(receipt.getReceiptNo());
        SensorView temperature = find(readings, "temperature");
        SensorView humidity = find(readings, "humidity");
        monitor.setTemperature(temperature == null ? null : temperature.value());
        monitor.setHumidity(humidity == null ? null : humidity.value());
        monitor.setDeviceCode(sourceDevice(temperature == null ? humidity : temperature, readings));
        monitor.setDeviceNote(note);
        monitor.setDeviceStatus(deviceStatus(pool));
        AlertView alert = relatedAlert(receipt);
        monitor.setAlertLevel(alert == null ? "无" : alert.level());
        monitor.setAlertContent(alert == null ? "仓储读数正常，无相关告警" : alert.title() + "：" + nullToDash(alert.content()));
        monitor.setMonitorTime(LocalDateTime.now());
        monitor.setCreatedAt(LocalDateTime.now());
        monitor.setUpdatedAt(LocalDateTime.now());
        monitor.setDelFlag(0);
        monitorService.save(monitor);
        return monitor;
    }

    private BatchView requireBatch(String batchId) {
        BatchView batch = productionClient.batch(batchId);
        if (batch == null) {
            throw new BusinessException(404, "在生产域查不到采收批次 " + batchId
                    + "（批次不存在，或它不属于当前登录主体）");
        }
        return batch;
    }

    private PledgeGoods requireEnabledGoods(String goodsCode) {
        if (goodsCode == null) {
            throw new BusinessException(400, "请选择质押物品种（质押物字典），不同品种的折算率上限不一样");
        }
        PledgeGoods goods = pledgeGoodsService.lambdaQuery()
                .eq(PledgeGoods::getGoodsCode, goodsCode)
                .eq(PledgeGoods::getDelFlag, 0)
                .last("LIMIT 1")
                .one();
        if (goods == null) {
            throw new BusinessException(404, "质押物字典里没有编码「" + goodsCode
                    + "」，请联系平台运营在质押物目录里维护后再开仓单");
        }
        if (!"启用".equals(goods.getStatus())) {
            throw new BusinessException(409, "质押物「" + goods.getGoodsName() + "」已被平台停用，不能开仓单");
        }
        return goods;
    }

    private WarehouseReceipt unreleasedOf(String borrowerId, String batchNo) {
        return lambdaQuery()
                .eq(WarehouseReceipt::getUserId, borrowerId)
                .eq(WarehouseReceipt::getBatchNo, batchNo)
                .ne(WarehouseReceipt::getStatus, RELEASED)
                .eq(WarehouseReceipt::getDelFlag, 0)
                .orderByDesc(WarehouseReceipt::getCreatedAt)
                .last("LIMIT 1")
                .one();
    }

    /** 在库可用量 = 各分仓 {@code currentQty - frozenQty} 之和；冻结的部分已经在处置，不能再担保。 */
    private BigDecimal availableQuantity(List<InventoryView> inventories) {
        BigDecimal available = BigDecimal.ZERO;
        for (InventoryView item : inventories) {
            BigDecimal current = item.currentQty() == null ? BigDecimal.ZERO : item.currentQty();
            BigDecimal frozen = item.frozenQty() == null ? BigDecimal.ZERO : item.frozenQty();
            available = available.add(current.subtract(frozen).max(BigDecimal.ZERO));
        }
        return available.setScale(3, RoundingMode.HALF_UP);
    }

    private List<String> idsOf(List<DeviceView> devices) {
        return devices.stream().map(DeviceView::deviceId).toList();
    }

    private SensorView find(List<SensorView> readings, String sensorType) {
        for (SensorView reading : readings) {
            if (sensorType.equalsIgnoreCase(reading.sensorType()) && reading.value() != null) {
                return reading;
            }
        }
        return null;
    }

    /** 读数出处设备：优先用取到读数的那台，一个都没取到时退回设备台账的第一台（页面要能看出是谁）。 */
    private String sourceDevice(SensorView first, List<SensorView> readings) {
        if (first != null && first.deviceCode() != null) {
            return first.deviceCode();
        }
        return readings.isEmpty() ? null : readings.get(0).deviceCode();
    }

    private String deviceStatus(List<DeviceView> devices) {
        if (devices.isEmpty()) {
            return "无设备";
        }
        long online = devices.stream().filter(item -> Integer.valueOf(1).equals(item.onlineStatus())).count();
        if (online == 0) {
            return "全部离线";
        }
        if (online == devices.size()) {
            return "在线";
        }
        return online + "/" + devices.size() + " 在线";
    }

    /** 与本仓单相关的告警：生产域告警正文里写的是批次号，按批次号命中最不容易误报。 */
    private AlertView relatedAlert(WarehouseReceipt receipt) {
        if (receipt.getBatchNo() == null) {
            return null;
        }
        List<AlertView> alerts = productionClient.alerts();
        for (AlertView alert : alerts) {
            boolean hit = contains(alert.content(), receipt.getBatchNo())
                    || contains(alert.title(), receipt.getBatchNo())
                    || contains(alert.sourceName(), receipt.getBatchNo());
            if (hit && !"handled".equalsIgnoreCase(String.valueOf(alert.status()))) {
                return alert;
            }
        }
        return null;
    }

    private boolean contains(String haystack, String needle) {
        return haystack != null && needle != null && haystack.contains(needle);
    }

    private String nullToDash(String value) {
        return value == null || value.isBlank() ? "（无正文）" : value;
    }

    private String text(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String textOr(Object value, String fallback) {
        String text = text(value);
        return text == null ? fallback : text;
    }

    private BigDecimal decimal(Object value, BigDecimal fallback) {
        String text = text(value);
        if (text == null) {
            return fallback;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "数量与单价都必须是数字，收到：" + text);
        }
    }
}
