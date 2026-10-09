package com.agri.core.infra.event;

/**
 * 事件传输通道 SPI。
 * 默认 local：进程内直接回调 TopicListener（开发/单机模式，零外部依赖）。
 * rocketmq：经 RocketMQ 投递（ADR-003 正式形态，多实例部署时必选）。
 * 切换仅改配置 agri.event.transport，事件契约与业务代码不变。
 */
public interface EventTransport {

    void publish(DomainEvent event) throws Exception;
}
