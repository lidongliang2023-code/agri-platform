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
 * 投递（HTTP 到平台 / RocketMQ）是下一步接一个 relay —— 接的时候业务代码一行不动，
 * 只需要把 {@code publish} 之后的那一环换成平台的 {@code EventTransport} 实现。
 * 现在没有 relay，所以状态停在 NEW，查询时一眼能看出"产生了但还没投递"。</p>
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

    @TableField("tenant_id")
    private String tenantId;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @TableField("create_time")
    private LocalDateTime createTime;
}
