package com.agri.finance.service.impl;

import com.agri.finance.entity.MessageNotification;
import com.agri.finance.mapper.MessageNotificationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class MessageNotificationServiceImpl extends ServiceImpl<MessageNotificationMapper, MessageNotification> {

    public List<MessageNotification> getUserMessages(String userId) {
        LambdaQueryWrapper<MessageNotification> query = new LambdaQueryWrapper<>();
        query.eq(MessageNotification::getUserId, userId)
             .eq(MessageNotification::getDelFlag, 0)
             .orderByDesc(MessageNotification::getCreatedAt);
        return list(query);
    }

    public long getUnreadCount(String userId) {
        LambdaQueryWrapper<MessageNotification> query = new LambdaQueryWrapper<>();
        query.eq(MessageNotification::getUserId, userId)
             .eq(MessageNotification::getIsRead, false)
             .eq(MessageNotification::getDelFlag, 0);
        return count(query);
    }

    public void markAsRead(String messageId) {
        MessageNotification message = getById(messageId);
        if (message != null) {
            message.setIsRead(true);
            updateById(message);
        }
    }

    public void markAllRead(String userId) {
        LambdaQueryWrapper<MessageNotification> query = new LambdaQueryWrapper<>();
        query.eq(MessageNotification::getUserId, userId)
             .eq(MessageNotification::getIsRead, false)
             .eq(MessageNotification::getDelFlag, 0);
        List<MessageNotification> messages = list(query);
        messages.forEach(m -> m.setIsRead(true));
        updateBatchById(messages);
    }

    public MessageNotification createMessage(MessageNotification message) {
        message.setMessageNo("MSG" + System.currentTimeMillis());
        message.setIsRead(false);
        message.setCreatedAt(LocalDateTime.now());
        message.setDelFlag(0);
        save(message);
        return message;
    }

    /**
     * 业务动作完成后给某个主体发一条站内消息。
     *
     * <p>状态机推进了却不通知，用户只能靠刷新页面猜 —— 签署、放款、还款、逾期
     * 都从这里出，消息与业务写在同一个事务里。</p>
     */
    public MessageNotification notify(String userId, String type, String title, String content,
                                      String bizType, String bizId, String priority) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        MessageNotification message = new MessageNotification();
        message.setUserId(userId);
        message.setMessageType(type);
        message.setTitle(title);
        message.setContent(content);
        message.setRelatedBizType(bizType);
        message.setRelatedBizId(bizId);
        message.setPriority(priority);
        message.setStatus("ACTIVE");
        return createMessage(message);
    }

    public MessageNotification notifyBorrower(String userId, String type, String title, String content,
                                              String bizType, String bizId) {
        return notify(userId, type, title, content, bizType, bizId, "HIGH");
    }

    public void deleteMessage(String messageId) {
        MessageNotification message = getById(messageId);
        if (message != null) {
            message.setDelFlag(1);
            updateById(message);
        }
    }
}