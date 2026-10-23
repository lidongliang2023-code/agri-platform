package com.agri.finance.controller;

import com.agri.finance.entity.MessageNotification;
import com.agri.finance.service.impl.MessageNotificationServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/message")
public class MessageController {

    @Autowired
    private MessageNotificationServiceImpl messageService;

    @GetMapping("/list")
    public Map<String, Object> getMessages(@RequestParam String userId) {
        List<MessageNotification> messages = messageService.getUserMessages(userId);
        return Map.of("code", 200, "message", "success", "data", messages);
    }

    @GetMapping("/unread-count")
    public Map<String, Object> getUnreadCount(@RequestParam String userId) {
        long count = messageService.getUnreadCount(userId);
        return Map.of("code", 200, "message", "success", "data", count);
    }

    @PostMapping("/read/{messageId}")
    public Map<String, Object> markAsRead(@PathVariable String messageId) {
        messageService.markAsRead(messageId);
        return Map.of("code", 200, "message", "标记成功");
    }

    @PostMapping("/read-all")
    public Map<String, Object> markAllRead(@RequestParam String userId) {
        messageService.markAllRead(userId);
        return Map.of("code", 200, "message", "全部标记成功");
    }

    @PostMapping("/create")
    public Map<String, Object> createMessage(@RequestBody MessageNotification message) {
        MessageNotification result = messageService.createMessage(message);
        return Map.of("code", 200, "message", "创建成功", "data", result);
    }

    @DeleteMapping("/{messageId}")
    public Map<String, Object> deleteMessage(@PathVariable String messageId) {
        messageService.deleteMessage(messageId);
        return Map.of("code", 200, "message", "删除成功");
    }
}