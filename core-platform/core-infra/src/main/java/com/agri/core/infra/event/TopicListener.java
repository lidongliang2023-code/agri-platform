package com.agri.core.infra.event;

/**
 * 事件监听 SPI：模块消费事件时实现本接口（payload 字符串由消费方用 JsonUtil 反序列化为生产方 api 包中的事件 DTO）。
 * local 模式下由进程内总线直接回调；rocketmq 模式下由 RocketMqConsumerStarter 为每个监听器创建独立消费者。
 */
public interface TopicListener {

    /** 订阅的事件主题（与生产方 api 包中的 TOPIC 常量一致） */
    String topic();

    /** 处理事件 payload（JSON）。消费端必须保证幂等。 */
    void onMessage(String payload) throws Exception;
}
