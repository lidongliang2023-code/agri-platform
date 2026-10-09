package com.agri.core.infra.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 领域事件统一信封。
 * 事件契约由各生产方模块的 api 包定义（payload DTO + TOPIC 常量），消费方仅依赖生产方 api 包。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DomainEvent {

    /** 事件唯一 ID */
    private String eventId;
    /** 事件主题，如 order.deal.done */
    private String topic;
    /** 事件业务键（用于幂等与排序） */
    private String eventKey;
    /** payload JSON */
    private String payload;
    private Long marketId;
    private Long tenantId;
    private LocalDateTime occurredAt;
}
