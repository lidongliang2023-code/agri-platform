package com.agri.satellite.iot;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.core.infra.util.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 数据接入服务：REST / MQTT 双通道汇入。
 * 链路（8.2）：设备 → 边缘网关 → EMQX → 本服务 → ① 时序存储 ② 阈值预警（经事件总线回传核心）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IngestService {

    private final JdbcTemplate jdbc;
    private final DomainEventPublisher eventPublisher;
    private final IotThresholds thresholds;

    public Map<String, Object> ingest(String deviceNo, String metric, BigDecimal value, Long marketId) {
        long mid = marketId == null ? 1L : marketId;
        jdbc.update("INSERT INTO iot_device_reading (market_id, device_no, metric, metric_value, reported_at) VALUES (?,?,?,?,NOW())",
                mid, deviceNo, metric, value);

        BigDecimal threshold = thresholds.forMetric(metric);
        if (threshold == null || value.compareTo(threshold) <= 0) {
            return Map.of("alert", false);
        }

        String level = value.compareTo(threshold.multiply(new BigDecimal("1.2"))) > 0 ? "CRITICAL" : "WARN";
        String message = deviceNo + " " + metric + "=" + value + "（阈值 " + threshold + "）";
        jdbc.update("INSERT INTO iot_alert_log (market_id, device_no, metric, metric_value, threshold, level, message, created_at) VALUES (?,?,?,?,?,?,?,NOW())",
                mid, deviceNo, metric, value, threshold, level, message);

        // 本地消息表与告警落库非同事务（本服务无跨表业务事务）；重试与死信由 OutboxRelay 保证最终可达
        eventPublisher.publish(IotTopics.IOT_ALERT_RAISED, deviceNo + ":" + System.currentTimeMillis(),
                new IotTopics.IotAlertPayload(deviceNo, metric, value, threshold, level, message,
                        mid, LocalDateTime.now().toString()));
        log.warn("IoT 预警已触发并投递: {}", message);
        return Map.of("alert", true, "level", level);
    }
}
