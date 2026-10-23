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

    public void deleteMessage(String messageId) {
        MessageNotification message = getById(messageId);
        if (message != null) {
            message.setDelFlag(1);
            updateById(message);
        }
    }
}