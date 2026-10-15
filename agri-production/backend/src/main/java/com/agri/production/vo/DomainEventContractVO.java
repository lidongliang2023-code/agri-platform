package com.agri.production.vo;

import com.agri.production.entity.DomainEventRecord;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 领域事件 outbox 的对外形状（运营端"事件投递"台账用）。
 *
 * <p>刻意把 {@code status} / {@code retryCount} / {@code lastError} 一并给出：
 * 投递这件事最怕的是"看起来发出去了"—— 状态、试了几次、上次为什么失败，
 * 这三样在一起才能让人一眼判断事件到底走出去没有。</p>
 */
@Data
public class DomainEventContractVO {

    private Long id;
    private String eventType;
    private String eventKey;
    /** NEW 待投递 / SENT 已投递 / DEAD 投递失败（死信，可重放） */
    private String status;
    private Integer retryCount;
    private LocalDateTime nextRetryAt;
    /** 最近一次投递失败的原因；已投递时为空 */
    private String lastError;
    private LocalDateTime occurredAt;
    private LocalDateTime sentAt;
    private String payload;

    public static DomainEventContractVO of(DomainEventRecord entity) {
        DomainEventContractVO vo = new DomainEventContractVO();
        vo.id = entity.getId();
        vo.eventType = entity.getEventType();
        vo.eventKey = entity.getEventKey();
        vo.status = entity.getStatus();
        vo.retryCount = entity.getRetryCount();
        vo.nextRetryAt = entity.getNextRetryAt();
        vo.lastError = entity.getLastError();
        vo.occurredAt = entity.getOccurredAt();
        vo.sentAt = entity.getSentAt();
        vo.payload = entity.getPayload();
        return vo;
    }
}
