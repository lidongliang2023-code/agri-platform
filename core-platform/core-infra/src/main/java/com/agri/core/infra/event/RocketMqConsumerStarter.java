package com.agri.core.infra.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.consumer.DefaultMQPushConsumer;
import org.apache.rocketmq.client.consumer.listener.ConsumeConcurrentlyContext;
import org.apache.rocketmq.client.consumer.listener.ConsumeConcurrentlyStatus;
import org.apache.rocketmq.client.consumer.listener.MessageListenerConcurrently;
import org.apache.rocketmq.common.message.MessageExt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * RocketMQ 消费桥：为每个 {@link TopicListener} 创建独立消费者（每组仅订阅一个主题，避免组内订阅关系不一致）。
 * 监听器抛异常 → RECONSUME_LATER，由 MQ 重试并最终进入死信（消费端仍应自行保证幂等）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "agri.event.transport", havingValue = "rocketmq")
public class RocketMqConsumerStarter implements SmartLifecycle {

    @Value("${agri.event.rocketmq.name-server:localhost:9876}")
    private String nameServer;

    private final List<TopicListener> listeners;
    private final List<DefaultMQPushConsumer> consumers = new ArrayList<>();
    private volatile boolean running;

    @Override
    public void start() {
        for (TopicListener listener : listeners) {
            try {
                DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("agri-cg-" + RocketMqEventTransport.mqTopic(listener.topic()));
                consumer.setNamesrvAddr(nameServer);
                consumer.subscribe(RocketMqEventTransport.mqTopic(listener.topic()), "*");
                // 每个消费者与其监听器一一绑定，避免跨主题误投
                consumer.registerMessageListener((MessageListenerConcurrently) (msgs, ctx) -> consume(listener, msgs));
                consumer.start();
                consumers.add(consumer);
                log.info("RocketMQ 消费者已启动: topic={}, listener={}", listener.topic(), listener.getClass().getSimpleName());
            } catch (Exception e) {
                log.error("RocketMQ 消费者启动失败: topic={}, {}", listener.topic(), e.getMessage(), e);
            }
        }
        running = true;
    }

    private ConsumeConcurrentlyStatus consume(TopicListener listener, List<MessageExt> msgs) {
        for (MessageExt msg : msgs) {
            try {
                String payload = new String(msg.getBody(), StandardCharsets.UTF_8);
                listener.onMessage(payload);
            } catch (Exception e) {
                log.error("事件消费失败，将重试: msgId={}, {}", msg.getMsgId(), e.getMessage(), e);
                return ConsumeConcurrentlyStatus.RECONSUME_LATER;
            }
        }
        return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
    }

    @Override
    public void stop() {
        for (DefaultMQPushConsumer consumer : consumers) {
            consumer.shutdown();
        }
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
