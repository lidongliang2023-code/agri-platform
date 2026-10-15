package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 领域事件 outbox（**与 core-platform core-infra 的 OutboxMessage 同构**）。
 *
 * <p>口径（2026-10-14 拍板：事件口径"按建议执行"）：平台侧已经有一整套领域事件基础设施 ——
 * {@code DomainEventPublisher} + {@code EventTransport}（local/http/rocketmq 三种实现）
 * + 事务性 outbox（{@code OutboxMessage} / {@code OutboxService} / {@code OutboxRelay}，
 * 状态用 {@code NEW} → {@code SENT}）。所以本服务**不自创机制**，而是落一张同构的 outbox 表，
 * payload 形状照抄 {@code ProduceEvents} 里那几个 record 的字段名与含义。</p>
 *
 * <p><b>绝不谎报"已发送"</b>：这里只负责把事件**落库**（status = NEW，sent_at 为空）。
 * 投递交给 {@code DomainEventRelay}：它把 NEW 的事件投给配置的接收端，**收到接收端确认**
 * （响应体 {@code code == 0}）才置 SENT。业务代码一行不动。</p>
 *
 * <p>{@code marketId} 刻意不落：本服务的口径是"一主体一租户、不需要市场维度"，
 * 平台侧 record 里那个 marketId 字段在 payload 里给 null。</p>
 */
@Data
@TableName("agri_prod_domain_event")
public class DomainEventRecord {

    /** 未投递（与平台 OutboxMessage.STATUS_NEW 同名，便于将来统一对接） */
    public static final String STATUS_NEW = "NEW";
    /** 已投递 */
    public static final String STATUS_SENT = "SENT";
    /**
     * 投递失败且已用尽重试（死信）。**不等于**"消费端已处理"，
     * 而是"投不出去，等消费端/配置就位后用 replay 重放"。
     */
    public static final String STATUS_DEAD = "DEAD";

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 事件类型，取值与 ProduceEvents 的常量一致，如 prod.batch.harvested */
    @TableField("event_type")
    private String eventType;

    /** 事件键（通常是业务主键，便于消费者幂等） */
    @TableField("event_key")
    private String eventKey;

    /** 事件载荷（JSON；字段名与 ProduceEvents 的 record 对齐） */
    @TableField("payload")
    private String payload;

    /** NEW 未投递 / SENT 已投递 */
    @TableField("status")
    private String status;

    /** 事件发生时间（业务时间，不是入库时间） */
    @TableField("occurred_at")
    private LocalDateTime occurredAt;

    /** 投递时间；未投递时为空 */
    @TableField("sent_at")
    private LocalDateTime sentAt;

    /** 已尝试投递次数（成功也计一次） */
    @TableField("retry_count")
    private Integer retryCount;

    /** 下次可投递时间；为空表示立即可投（退避用） */
    @TableField("next_retry_at")
    private LocalDateTime nextRetryAt;

    /**
     * 最近一次投递失败的原因（原样记录，例如"接收端无该 topic 的监听器(code=404)"）。
     * 之所以要落库：投递失败如果只写日志，翻页面上看不到 —— 状态栏里那一句才是现场。
     */
    @TableField("last_error")
    private String lastError;

    @TableField("tenant_id")
    private String tenantId;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @TableField("create_time")
    private LocalDateTime createTime;
}
