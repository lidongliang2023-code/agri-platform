package com.agri.core.infra.event;

import com.agri.core.infra.web.MarketContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 领域事件发布门面：业务代码只调用 publish(topic, key, payload)，一律落本地消息表（ADR-003 唯一通道）。
 * 禁止绕过本门面直接投递。
 */
@Component
@RequiredArgsConstructor
public class DomainEventPublisher {

    private final OutboxService outboxService;
    private final ObjectMapper objectMapper;

    public void publish(String topic, String eventKey, Object payload) {
        try {
            outboxService.append(DomainEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .topic(topic)
                    .eventKey(eventKey)
                    .payload(objectMapper.writeValueAsString(payload))
                    .marketId(MarketContext.currentMarketId())
                    .occurredAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            // 序列化失败属于代码缺陷，直接中断业务事务比静默丢事件更安全
            throw new IllegalStateException("领域事件发布失败: " + topic, e);
        }
    }
}
