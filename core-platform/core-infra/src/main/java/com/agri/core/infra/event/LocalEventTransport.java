package com.agri.core.infra.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 进程内事件总线（开发模式默认）。
 * 监听器异常被捕获并记录：本地模式视同已投递，不阻塞 Outbox 状态推进。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "agri.event.transport", havingValue = "local", matchIfMissing = true)
public class LocalEventTransport implements EventTransport {

    private final List<TopicListener> listeners;

    @Override
    public void publish(DomainEvent event) {
        boolean matched = false;
        for (TopicListener listener : listeners) {
            if (listener.topic().equals(event.getTopic())) {
                matched = true;
                try {
                    listener.onMessage(event.getPayload());
                } catch (Exception e) {
                    log.error("[{}] 本地事件监听器处理失败: {}", event.getEventId(), listener.getClass().getName(), e);
                }
            }
        }
        if (!matched) {
            log.debug("[{}] 事件 {} 无本地订阅者", event.getEventId(), event.getTopic());
        }
    }
}
