package com.agri.production.service;

import java.util.Map;

/**
 * 领域事件发布（outbox 口径）。
 *
 * <p>事件类型常量与 core-platform {@code ProduceEvents} 完全一致；payload 的字段名也照抄
 * 那边的 record（{@code ProdBatchHarvested} / {@code QualityTestPassed} /
 * {@code QualityTestFailed} / {@code TraceActivated}），这样将来接投递时消费者拿到的东西
 * 就是它期望的形状。</p>
 */
public interface IDomainEventService {

    /** 采收批次生成（契约：prod.batch.harvested） */
    void batchHarvested(String batchId, String batchNo, String plotId, String cropId,
                        String quantity, String unit, String harvestedAt, String tenantId);

    /** 质检结论（契约：prod.quality.test.passed / failed） */
    void qualityTested(boolean passed, String batchId, String batchCode, String inspectionId,
                      String inspectionNo, String item, String reason, String testedAt, String tenantId);

    /** 溯源码激活（契约：prod.trace.activated） */
    void traceActivated(String code, String batchId, String batchNo, String activatedBy,
                        String activatedAt, String tenantId);

    /**
     * 通用发布：把事件以 status=NEW 落库（**不投递**）。
     *
     * @param eventType 事件类型（与 ProduceEvents 常量同名）
     * @param eventKey  事件键（业务主键）
     * @param payload   载荷（字段名与平台 record 对齐；marketId 一律 null）
     */
    void publish(String eventType, String eventKey, Map<String, Object> payload, String tenantId);
}
