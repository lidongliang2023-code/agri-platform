package com.agri.produce.internal.message;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 站内通知（任务/告警/质检/系统） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class MessageNotifyService {

    private static final String ID_PREFIX = "MSGN";

    private final MessageNotifyMapper messageNotifyMapper;

    /**
     * 分页查询。
     *
     * @param keyword title 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<MessageNotifyEntity> page(long page, long size, String keyword, Integer status) {
        Page<MessageNotifyEntity> result = messageNotifyMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<MessageNotifyEntity>()
                        .like(keyword != null && !keyword.isBlank(), MessageNotifyEntity::getTitle, keyword)
                        .eq(status != null, MessageNotifyEntity::getStatus, status)
                        .orderByDesc(MessageNotifyEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public MessageNotifyEntity detail(String id) {
        MessageNotifyEntity entity = messageNotifyMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public MessageNotifyEntity create(MessageNotifyEntity entity) {
        if (entity.getMessageId() == null || entity.getMessageId().isBlank()) {
            entity.setMessageId(ProduceIds.newId(ID_PREFIX));
        }
        messageNotifyMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public MessageNotifyEntity update(String id, MessageNotifyEntity entity) {
        entity.setMessageId(id);
        messageNotifyMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        messageNotifyMapper.deleteById(id);
    }

    /** 发送消息 */
    @Transactional
    public MessageNotifyEntity send(MessageNotifyEntity message) {
        if (message.getMessageId() == null || message.getMessageId().isBlank()) {
            message.setMessageId(ProduceIds.newId("MSGN"));
        }
        message.setReadFlag(0);
        message.setSentAt(LocalDateTime.now());
        message.setStatus(1);
        messageNotifyMapper.insert(message);
        return message;
    }

    /** 标记已读 */
    @Transactional
    public MessageNotifyEntity markRead(String messageId) {
        MessageNotifyEntity message = detail(messageId);
        message.setReadFlag(1);
        message.setReadAt(LocalDateTime.now());
        messageNotifyMapper.updateById(message);
        return message;
    }

    /** 未读数 */
    public long unreadCount(String receiverId) {
        return messageNotifyMapper.selectCount(new LambdaQueryWrapper<MessageNotifyEntity>()
                .eq(MessageNotifyEntity::getReceiverId, receiverId)
                .eq(MessageNotifyEntity::getReadFlag, 0)
                .eq(MessageNotifyEntity::getStatus, 1));
    }
}
