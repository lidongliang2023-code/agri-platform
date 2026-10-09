package com.agri.produce.internal.message;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 生产域消息通知（用户端）。
 *
 * <p>显式指定 Bean 名：mod-platform 下存在同名 {@code com.agri.platform.internal.message.MessageController}，
 * 两者同被 core-app 组件扫描覆盖，默认 Bean 名 {@code messageController} 冲突会导致
 * {@code ConflictingBeanDefinitionException}、应用起不来。此处按模块前缀消歧。</p>
 */
@RestController("produceMessageController")
@RequestMapping("/api/v1/production/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageNotifyService messageNotifyService;

    @GetMapping
    public ApiResponse<PageResult<MessageNotifyEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                             @RequestParam(defaultValue = "10") long size,
                                                             @RequestParam(required = false) String keyword,
                                                             @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(messageNotifyService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<MessageNotifyEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(messageNotifyService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody MessageNotifyEntity entity) {
        return ApiResponse.ok(messageNotifyService.create(entity).getMessageId());
    }

    @PutMapping("/{id}")
    public ApiResponse<MessageNotifyEntity> update(@PathVariable String id, @RequestBody MessageNotifyEntity entity) {
        return ApiResponse.ok(messageNotifyService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        messageNotifyService.delete(id);
        return ApiResponse.ok();
    }

    /** 发送消息 */
    @PostMapping("/send")
    public ApiResponse<MessageNotifyEntity> send(@RequestBody MessageNotifyEntity message) {
        return ApiResponse.ok(messageNotifyService.send(message));
    }

    /** 标记已读 */
    @PostMapping("/{messageId}/read")
    public ApiResponse<MessageNotifyEntity> markRead(@PathVariable String messageId) {
        return ApiResponse.ok(messageNotifyService.markRead(messageId));
    }

    /**
     * 未读数。
     *
     * <p>{@code receiverId} 改为可选（原为必填，前端「我的未读」不传参 → 每次布局渲染都触发
     * MissingServletRequestParameterException，且被全局异常处理器包装成 HTTP 200 的 code:500，
     * 只有看响应体才能发现）。语义上该接口查的就是当前登录人的未读数，
     * 故缺省时由服务端从认证上下文取（见 {@link MessageNotifyService#unreadCount(String)}）。
     *
     * @param receiverId 可选；传入时按传入值查（保留兼容）
     * @return 未读条数
     */
    @GetMapping("/unread-count")
    public ApiResponse<Long> unreadCount(@RequestParam(required = false) String receiverId) {
        return ApiResponse.ok(messageNotifyService.unreadCount(receiverId));
    }
}
