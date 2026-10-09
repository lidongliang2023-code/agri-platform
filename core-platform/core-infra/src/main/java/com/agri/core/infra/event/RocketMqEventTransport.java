package com.agri.core.infra.event;

import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.producer.DefaultMQProducer;
import org.apache.rocketmq.common.message.Message;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * RocketMQ 投递适配（ADR-003 正式形态）。
 * 说明：RocketMQ topic 命名不允许「.」，故映射为下划线；原事件主题作为消息 Tag 保留，便于消费过滤与排障。
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "agri.event.transport", havingValue = "rocketmq")
public class RocketMqEventTransport implements EventTransport, SmartLifecycle {

    @Value("${agri.event.rocketmq.name-server:localhost:9876}")
    private String nameServer;

    @Value("${agri.event.rocketmq.producer-group:agri-event-producer}")
    private String producerGroup;

    private DefaultMQProducer producer;
    private volatile boolean running;

    public static String mqTopic(String topic) {
        return topic.replace('.', '_');
    }

    @Override
    public void publish(DomainEvent event) throws Exception {
        Message message = new Message(
                mqTopic(event.getTopic()),
                event.getTopic(),
                event.getEventKey(),
                event.getPayload().getBytes(StandardCharsets.UTF_8));
        producer.send(message);
    }

    @Override
    public void start() {
        producer = new DefaultMQProducer(producerGroup);
        producer.setNamesrvAddr(nameServer);
        try {
            producer.start();
            log.info("RocketMQ 生产者已启动: {}", nameServer);
        } catch (Exception e) {
            // 启动失败不阻塞应用：Outbox 重试机制会在 MQ 恢复后自动补投
            log.error("RocketMQ 生产者启动失败（Outbox 将持续重试）: {}", e.getMessage(), e);
        }
        running = true;
    }

    @Override
    public void stop() {
        if (producer != null) {
            producer.shutdown();
        }
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
