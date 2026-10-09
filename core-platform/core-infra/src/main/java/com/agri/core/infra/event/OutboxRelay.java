package com.agri.core.infra.event;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Outbox 中继：轮询待投递消息 → 经 EventTransport 投递 → 标记已发送；
 * 失败按指数退避重试，超过上限进入死信（status=2），可人工排查后重放。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxRelay {

    private final OutboxMapper outboxMapper;
    private final EventTransport transport;

    @Value("${agri.event.outbox.batch-size:50}")
    private int batchSize;

    @Value("${agri.event.outbox.max-retry:5}")
    private int maxRetry;

    @Value("${agri.event.outbox.backoff-base-seconds:30}")
    private long backoffBaseSeconds;

    @Scheduled(fixedDelayString = "${agri.event.outbox.relay-interval-ms:2000}")
    public void relay() {
        List<OutboxMessage> pending = outboxMapper.selectList(new LambdaQueryWrapper<OutboxMessage>()
                .eq(OutboxMessage::getStatus, OutboxMessage.STATUS_NEW)
                .le(OutboxMessage::getNextRetryAt, LocalDateTime.now())
                .orderByAsc(OutboxMessage::getId)
                .last("LIMIT " + batchSize));
        for (OutboxMessage message : pending) {
            deliver(message);
        }
    }

    private void deliver(OutboxMessage message) {
        DomainEvent event = DomainEvent.builder()
                .eventId(String.valueOf(message.getId()))
                .topic(message.getEventType())
                .eventKey(message.getEventKey())
                .payload(message.getPayload())
                .marketId(message.getMarketId())
                .tenantId(message.getTenantId())
                .occurredAt(message.getCreatedAt())
                .build();
        try {
            transport.publish(event);
            message.setStatus(OutboxMessage.STATUS_SENT);
            message.setUpdatedAt(LocalDateTime.now());
            outboxMapper.updateById(message);
        } catch (Exception e) {
            int retryCount = message.getRetryCount() == null ? 1 : message.getRetryCount() + 1;
            message.setRetryCount(retryCount);
            if (retryCount >= maxRetry) {
                message.setStatus(OutboxMessage.STATUS_DEAD);
                log.error("[{}] 事件投递进入死信: topic={}, key={}", message.getId(), message.getEventType(), message.getEventKey(), e);
            } else {
                long backoff = backoffBaseSeconds * (1L << retryCount);
                message.setNextRetryAt(LocalDateTime.now().plusSeconds(backoff));
            }
            message.setUpdatedAt(LocalDateTime.now());
            outboxMapper.updateById(message);
        }
    }
}
