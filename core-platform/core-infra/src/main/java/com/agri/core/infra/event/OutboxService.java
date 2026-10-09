package com.agri.core.infra.event;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 本地消息表写入服务：无 @Transactional 注解 —— 调用方若处于事务中则自动加入（同一本地事务，图 5 的核心），
 * 无事务时退化为自动提交（仍可被中继投递）。
 */
@Component
@RequiredArgsConstructor
public class OutboxService {

    private final OutboxMapper outboxMapper;

    public void append(DomainEvent event) {
        OutboxMessage message = new OutboxMessage();
        message.setEventType(event.getTopic());
        message.setEventKey(event.getEventKey());
        message.setPayload(event.getPayload());
        message.setMarketId(event.getMarketId());
        message.setTenantId(event.getTenantId());
        message.setStatus(OutboxMessage.STATUS_NEW);
        message.setRetryCount(0);
        message.setNextRetryAt(java.time.LocalDateTime.now());
        message.setCreatedAt(java.time.LocalDateTime.now());
        outboxMapper.insert(message);
    }
}
