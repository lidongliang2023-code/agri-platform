package com.agri.produce.api.event;

import java.math.BigDecimal;

/**
 * 生产域事件契约（即拆分预案）。
 * 注意：IOT_ALERT_RAISED 的生产方是卫星服务 satellite-iot（跨部署单元），此处为消费方持有的同一契约。
 *
 * <p>PRD 11.3 统一事件名（{@code prod.*}）以 {@code PROD_} 前缀常量暴露，供消息中心/政务报送/
 * 区块链存证等消费方订阅；历史短名常量保留以兼容已上线消费者。
 */
public final class ProduceEvents {

    /**
     * 【历史短名，存量兼容】批次已采收 → 交易域（商品挂载溯源码）、资讯（产地播报）。
     *
     * <p>本事件携带的是 <b>V1 prod_batch（旧农事批次）</b>的主键（雪花 Long），
     * mod-trade 的 BatchHarvestedListener 已在消费，保持语义不变以免破坏存量链路。
     * 新链路请勿订阅本事件，改用 {@link #PROD_BATCH_HARVESTED}。</p>
     */
    public static final String BATCH_HARVESTED = "batch.harvested";

    /** 检测合格 → 交易域（可信标识）、政务监管（报送） */
    public static final String QUALITY_TEST_PASSED = "quality.test.passed";

    /** IoT 预警已触发（生产方：satellite-iot）→ 消息中心（多端推送）、生产域（联动控制） */
    public static final String IOT_ALERT_RAISED = "iot.alert.raised";

    // ---------------------------------------------------------------- PRD 11.3 统一事件名

    /**
     * 采收批次生成 → 交易域（挂牌/商品挂载）、溯源（一物一码激活）。
     *
     * <p><b>口径明确：</b>载荷 {@link ProdBatchHarvested} 的 batchId / batchNo 取自
     * <b>prod_harvest_batch</b>（PRD 11.2.5 采收批次，批次体系权威表），
     * <b>不是</b> V1 的 prod_batch（旧农事批次）。batchId 为 varchar(32) 字符串，非雪花 Long。</p>
     *
     * <p>见 {@code V2__produce_domain.sql} 头部「遗留表与终态口径」；
     * 历史短名 {@link #BATCH_HARVESTED} 仍指向 prod_batch，仅供 mod-trade 存量兼容。</p>
     */
    public static final String PROD_BATCH_HARVESTED = "prod.batch.harvested";

    /** 质检合格 → 交易域（可信标识）、政务监管（合规报送） */
    public static final String PROD_QUALITY_TEST_PASSED = "prod.quality.test.passed";

    /** 质检不合格 → 批次冻结、监管预警、召回流程 */
    public static final String PROD_QUALITY_TEST_FAILED = "prod.quality.test.failed";

    /** 告警触发 → 消息中心（多端推送）、生产域（设备联动控制） */
    public static final String PROD_ALERT_TRIGGERED = "prod.alert.triggered";

    /** 溯源码激活 → 交易域（商品挂载溯源码）、区块链（存证锚定） */
    public static final String PROD_TRACE_ACTIVATED = "prod.trace.activated";

    /** 生产档案归档 → 区块链（存证锚定）、政务监管（归档报送） */
    public static final String PROD_RECORD_ARCHIVED = "prod.record.archived";

    /**
     * 投入品使用记录已登记 → 溯源（农事档案）、监管（农药残留合规）、库存（扣减）。
     *
     * <p>PRD 11.3 之外的第 7 个 {@code prod.*} 事件（产品侧回填文档）。
     * 触发点：{@code POST /api/v1/production/inputs/usages} 新增成功。</p>
     */
    public static final String PROD_INPUT_USAGE_RECORDED = "prod.input.usage.recorded";

    private ProduceEvents() {
    }

    /**
     * 【存量】prod_batch（旧农事批次）采收事件体，主键为雪花 Long。
     * 仅供 mod-trade BatchHarvestedListener 存量兼容，新链路请使用 {@link ProdBatchHarvested}。
     */
    public record BatchHarvested(Long batchId, String batchCode, Long productId, BigDecimal quantity,
                                 Long marketId, String harvestAt) {
    }

    /**
     * 采收批次事件体（PRD 11.3 prod.batch.harvested）。
     *
     * <p>batchId / batchNo 取自 <b>prod_harvest_batch</b>（权威表），batchId 为 varchar(32) 字符串；
     * 与 {@link BatchHarvested} 的 Long batchId（V1 prod_batch）不是同一套主键，勿混用。</p>
     */
    public record ProdBatchHarvested(String batchId, String batchNo, String plotId, String cropId,
                                     BigDecimal quantity, String unit, Long marketId, String harvestedAt) {
    }

    public record QualityTestPassed(Long batchId, String batchCode, String reportNo, String item,
                                    Long marketId, String testedAt) {
    }

    public record IotAlertRaised(String deviceNo, String metric, BigDecimal value, BigDecimal threshold,
                                 String level, String message, Long marketId, String raisedAt) {
    }

    /** 质检不合格事件体（PRD 11.3 prod.quality.test.failed） */
    public record QualityTestFailed(String batchId, String batchCode, String inspectionId, String inspectionNo,
                                    String item, String reason, Long marketId, String testedAt) {
    }

    /** 告警触发事件体（PRD 11.3 prod.alert.triggered） */
    public record AlertTriggered(String alertId, String ruleId, String deviceId, String metric,
                                 BigDecimal metricValue, String level, String message,
                                 Long marketId, String triggeredAt) {
    }

    /** 溯源码激活事件体（PRD 11.3 prod.trace.activated） */
    public record TraceActivated(String code, String batchId, String batchNo, String activatedBy,
                                 Long marketId, String activatedAt) {
    }

    /** 档案归档事件体（PRD 11.3 prod.record.archived） */
    public record RecordArchived(String bizType, String bizId, String batchId, String archiveNo,
                                 Long marketId, String archivedAt) {
    }

    /**
     * 投入品使用记录事件体（prod.input.usage.recorded）。
     *
     * <p>字段取自 prod_input_usage：usageId / inputId / inputName / batchNo（投入品批号）
     * / plotId / dosage / unit / usedAt / operator；batchNo 为投入品自身的农药/肥料批号，
     * 与采收批次号（prod_harvest_batch.batch_no）不是同一语义，勿混淆。</p>
     */
    public record InputUsageRecorded(String usageId, String inputId, String inputName, String batchNo,
                                     String plotId, BigDecimal dosage, String unit, String usedAt,
                                     String operator, Long marketId) {
    }
}
