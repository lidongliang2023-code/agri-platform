package com.agri.core.infra.event;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 本地消息表（ADR-003）：与业务在同一个本地事务写入，由 OutboxRelay 异步投递，保证「业务成功 ⇒ 事件必达」。
 */
@Data
@TableName("platform_outbox_message")
public class OutboxMessage {

    public static final int STATUS_NEW = 0;
    public static final int STATUS_SENT = 1;
    public static final int STATUS_DEAD = 2;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 事件主题，如 order.deal.done */
    private String eventType;
    /** 事件业务键 */
    private String eventKey;
    /** payload JSON */
    private String payload;

    private Long marketId;
    private Long tenantId;

    /** 0=待投递 1=已投递 2=死信 */
    private Integer status;
    private Integer retryCount;
    private LocalDateTime nextRetryAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
