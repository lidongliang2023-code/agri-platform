package com.agri.production.service.impl;

import com.agri.production.entity.DomainEventRecord;
import com.agri.production.mapper.DomainEventMapper;
import com.agri.production.service.IDomainEventService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 领域事件发布（outbox）：只落库、不投递。见 {@link IDomainEventService} 与实体的说明。
 *
 * <p>用 {@code REQUIRES_NEW}：事件与业务同事务会有一个坑 —— 业务回滚时事件也没了（那是对的），
 * 但业务提交后投递失败时事件却查不到"为什么没发"。这里让事件**独立提交**：
 * 业务成功就一定有事件记录（哪怕只是 NEW），业务失败就不留半条。</p>
 */
@Service
@Slf4j
public class DomainEventServiceImpl implements IDomainEventService {

    public static final String PROD_BATCH_HARVESTED = "prod.batch.harvested";
    public static final String PROD_QUALITY_TEST_PASSED = "prod.quality.test.passed";
    public static final String PROD_QUALITY_TEST_FAILED = "prod.quality.test.failed";
    public static final String PROD_TRACE_ACTIVATED = "prod.trace.activated";

    private final DomainEventMapper eventMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DomainEventServiceImpl(DomainEventMapper eventMapper) {
        this.eventMapper = eventMapper;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void batchHarvested(String batchId, String batchNo, String plotId, String cropId,
                              String quantity, String unit, String harvestedAt, String tenantId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("batchId", batchId);
        payload.put("batchNo", batchNo);
        payload.put("plotId", plotId);
        payload.put("cropId", cropId);
        payload.put("quantity", quantity);
        payload.put("unit", unit);
        payload.put("marketId", null);
        payload.put("harvestedAt", harvestedAt);
        publish(PROD_BATCH_HARVESTED, batchNo, payload, tenantId);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void qualityTested(boolean passed, String batchId, String batchCode, String inspectionId,
                             String inspectionNo, String item, String reason, String testedAt, String tenantId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (passed) {
            payload.put("batchId", toLongOrNull(batchId));
            payload.put("batchCode", batchCode);
            payload.put("reportNo", inspectionNo);
            payload.put("item", item);
            payload.put("marketId", null);
            payload.put("testedAt", testedAt);
            publish(PROD_QUALITY_TEST_PASSED, inspectionNo, payload, tenantId);
            return;
        }
        payload.put("batchId", toLongOrNull(batchId));
        payload.put("batchCode", batchCode);
        payload.put("inspectionId", inspectionId);
        payload.put("inspectionNo", inspectionNo);
        payload.put("item", item);
        payload.put("reason", reason);
        payload.put("marketId", null);
        payload.put("testedAt", testedAt);
        publish(PROD_QUALITY_TEST_FAILED, inspectionNo, payload, tenantId);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void traceActivated(String code, String batchId, String batchNo, String activatedBy,
                              String activatedAt, String tenantId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", code);
        payload.put("batchId", batchId);
        payload.put("batchNo", batchNo);
        payload.put("activatedBy", activatedBy);
        payload.put("marketId", null);
        payload.put("activatedAt", activatedAt);
        publish(PROD_TRACE_ACTIVATED, code, payload, tenantId);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void publish(String eventType, String eventKey, Map<String, Object> payload, String tenantId) {
        DomainEventRecord record = new DomainEventRecord();
        record.setEventType(eventType);
        record.setEventKey(eventKey);
        try {
            record.setPayload(objectMapper.writeValueAsString(payload == null ? Map.of() : payload));
        } catch (JsonProcessingException e) {
            // 载荷序列化失败属于编码问题（不是业务问题），直接抛出让上层回滚，别写一条残缺事件
            throw new IllegalStateException("事件载荷无法序列化：" + eventType, e);
        }
        record.setStatus(DomainEventRecord.STATUS_NEW);
        record.setOccurredAt(LocalDateTime.now());
        record.setTenantId(tenantId);
        record.setCreateTime(LocalDateTime.now());
        record.setDeleted(0);
        eventMapper.insert(record);
        log.info("领域事件已落库（未投递）：{} key={} id={}", eventType, eventKey, record.getId());
    }

    private static Long toLongOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
