package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.MessageNotification;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.MessageNotificationServiceImpl;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 业务消息。
 *
 * <p>收件人不再由前端说了算：只能读、只能标自己名下的收件箱
 * （融资主体号或自己绑定的资金机构号），传别人的收件人直接 403。</p>
 */
@RestController
@RequestMapping("/api/v1/message")
public class MessageController {

    private final MessageNotificationServiceImpl messageService;
    private final FinanceIdentityService identityService;

    public MessageController(MessageNotificationServiceImpl messageService,
                             FinanceIdentityService identityService) {
        this.messageService = messageService;
        this.identityService = identityService;
    }

    @GetMapping("/list")
    public Map<String, Object> getMessages(@RequestParam(defaultValue = "") String userId) {
        List<MessageNotification> messages = messageService.getUserMessages(
                identityService.resolveInbox(userId));
        return Map.of("code", 200, "message", "success", "data", messages);
    }

    @GetMapping("/unread-count")
    public Map<String, Object> getUnreadCount(@RequestParam(defaultValue = "") String userId) {
        long count = messageService.getUnreadCount(identityService.resolveInbox(userId));
        return Map.of("code", 200, "message", "success", "data", count);
    }

    @PostMapping("/read/{messageId}")
    public Map<String, Object> markAsRead(@PathVariable String messageId) {
        MessageNotification message = messageService.getById(messageId);
        if (message == null) {
            return Map.of("code", 404, "message", "消息不存在", "data", "");
        }
        identityService.resolveInbox(message.getUserId());
        messageService.markAsRead(messageId);
        return Map.of("code", 200, "message", "标记成功", "data", "");
    }

    @PostMapping("/read-all")
    public Map<String, Object> markAllRead(@RequestParam(defaultValue = "") String userId) {
        messageService.markAllRead(identityService.resolveInbox(userId));
        return Map.of("code", 200, "message", "全部标记成功", "data", "");
    }

    @DeleteMapping("/{messageId}")
    @OperatorOnly("finance:admin")
    public Map<String, Object> deleteMessage(@PathVariable String messageId) {
        messageService.deleteMessage(messageId);
        return Map.of("code", 200, "message", "删除成功", "data", "");
    }
}
