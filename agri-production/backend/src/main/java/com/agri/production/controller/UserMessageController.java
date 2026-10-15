package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IUserMessageService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.UserMessageVO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 用户端：消息中心（{@code /api/v1/production/messages}）。
 *
 * <p>页面实际使用的四条路径（其余是 api 层里已存在、暂无页面调用的，一并实现以免被网关回退到
 * 平台侧去写另一份数据）：</p>
 * <ul>
 *   <li>{@code GET /messages} —— 列表（production-view.ts 的 fetchMessages）；</li>
 *   <li>{@code POST /messages/{id}/read} —— 单条已读（同上）；</li>
 *   <li>{@code GET /messages/unread-count} —— 布局右上角角标（每个页面都会轮询）；</li>
 *   <li>{@code DELETE /messages/{id}} —— 消息中心删除；</li>
 *   <li>{@code PATCH /messages/{id}/read} 与 {@code PATCH /messages/read-all} —— api 层已有函数，
 *       未实现的话会被网关回退到平台侧执行（平台侧删/改的是另一张表，页面看起来"成功了"但列表不变）。</li>
 * </ul>
 *
 * <p>为什么不实现 {@code GET /messages/{id}}：页面没有详情调用（列表已带全文），
 * 多一个端点就多一处要维护的租户校验。</p>
 */
@RestController
@RequestMapping("/api/v1/production/messages")
public class UserMessageController {

    private final IUserMessageService messageService;

    public UserMessageController(IUserMessageService messageService) {
        this.messageService = messageService;
    }

    /** 消息分页（keyword / messageType / isRead 均可选）。 */
    @GetMapping
    public ApiResponse<PageResult<UserMessageVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer messageType,
            @RequestParam(required = false) Boolean isRead) {
        return ApiResponse.success(messageService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                TenantContextService.currentTenantId(), keyword, messageType, isRead));
    }

    /**
     * 未读条数。
     *
     * <p>返回 {@code Integer} 而不是 {@code Long}：平台侧踩过的坑是 Long 被全局序列化成字符串，
     * 前端 {@code unreadCount ?? 0} 兜不住非空字符串，角标会常驻一个 "0"。
     * 本服务当前没有 Long→String 的配置，但用 Integer 把这个隐患从契约上消掉。</p>
     */
    @GetMapping("/unread-count")
    public ApiResponse<Integer> unreadCount(@RequestParam(required = false) String receiverId) {
        return ApiResponse.success(messageService.unreadCount(TenantContextService.currentTenantId(), receiverId));
    }

    /** 标记单条已读（PATCH —— api/messages.ts 的用法）。 */
    @PatchMapping("/{messageId}/read")
    public ApiResponse<UserMessageVO> markReadByPatch(@PathVariable String messageId) {
        return ApiResponse.success(messageService.markRead(TenantContextService.currentTenantId(), messageId));
    }

    /** 标记单条已读（POST —— production-view.ts 的用法，页面当前走这条）。 */
    @PostMapping("/{messageId}/read")
    public ApiResponse<UserMessageVO> markRead(@PathVariable String messageId) {
        return ApiResponse.success(messageService.markRead(TenantContextService.currentTenantId(), messageId));
    }

    /** 全部标记已读，返回本次影响的条数。 */
    @PatchMapping("/read-all")
    public ApiResponse<Map<String, Object>> markAllRead() {
        int count = messageService.markAllRead(TenantContextService.currentTenantId());
        return ApiResponse.success(Map.of("updated", count));
    }

    /** 删除单条消息（逻辑删除）。 */
    @DeleteMapping("/{messageId}")
    public ApiResponse<Void> delete(@PathVariable String messageId) {
        messageService.delete(TenantContextService.currentTenantId(), messageId);
        return ApiResponse.success();
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
