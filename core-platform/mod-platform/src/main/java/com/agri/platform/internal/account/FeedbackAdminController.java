package com.agri.platform.internal.account;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.api.facade.MessageFacade;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 意见反馈处理（运营端）。
 *
 * <p>用户中心「意见反馈」的处置侧：列表 + 回复。</p>
 *
 * <p><b>权限</b>：挂在 {@code /api/v1/admin/feedback/**}，已随 {@code /api/v1/admin/identity-applications/**}
 * 一起收进 {@code JwtAuthFilter} 的 {@code SUPER_ADMIN_ONLY}。理由与身份审核相同：
 * 这类接口能看到用户提交的联系方式，不是"登录了就能看"的公共数据。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/feedback")
@RequiredArgsConstructor
public class FeedbackAdminController {

    private final UserFeedbackMapper userFeedbackMapper;
    private final UserMapper userMapper;
    private final MessageFacade messageFacade;

    /**
     * 分页查询反馈。
     *
     * @param status 单据状态：pending / replied / closed；为空或 all 表示全部
     * @param type   反馈类型：suggestion / bug / complaint / other；为空或 all 表示全部
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type) {
        int p = Math.max(pageNum, 1);
        int size = Math.min(Math.max(pageSize, 1), 100);
        LambdaQueryWrapper<UserFeedbackEntity> wrapper = new LambdaQueryWrapper<UserFeedbackEntity>()
                .eq(hasValue(status), UserFeedbackEntity::getStatus, status)
                .eq(hasValue(type), UserFeedbackEntity::getFeedbackType, type)
                .orderByAsc(UserFeedbackEntity::getStatus)
                .orderByDesc(UserFeedbackEntity::getCreatedAt)
                .orderByDesc(UserFeedbackEntity::getId);
        Page<UserFeedbackEntity> result = userFeedbackMapper.selectPage(new Page<>(p, size), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserFeedbackEntity entity : result.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(entity.getId()));
            row.put("userId", String.valueOf(entity.getUserId()));
            row.put("feedbackType", entity.getFeedbackType());
            row.put("title", entity.getTitle());
            row.put("content", entity.getContent());
            row.put("contact", entity.getContact());
            row.put("pagePath", entity.getPagePath());
            row.put("status", entity.getStatus());
            row.put("replyContent", entity.getReplyContent());
            row.put("replierName", entity.getReplierName());
            row.put("submitTime", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
            row.put("replyTime", entity.getReplyTime() == null ? null : entity.getReplyTime().toString());
            UserEntity submitter = userMapper.selectById(entity.getUserId());
            row.put("submitterName", submitter == null ? null
                    : (submitter.getNickname() == null ? submitter.getUsername() : submitter.getNickname()));
            rows.add(row);
        }
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("records", rows);
        page.put("total", result.getTotal());
        page.put("page", p);
        page.put("size", size);
        return ApiResponse.ok(page);
    }

    /**
     * 回复一条反馈。
     *
     * <p>已回复的单子允许再次回复（改口径、补说明是常见需求），回复内容以最后一次为准；
     * 但已关闭（closed）的不再接受回复。</p>
     */
    @PostMapping("/{id}/reply")
    public ApiResponse<Void> reply(@PathVariable Long id, @RequestBody ReplyRequest body) {
        UserFeedbackEntity entity = userFeedbackMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "反馈单不存在");
        }
        if ("closed".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该反馈已关闭，不能再回复");
        }
        String content = body == null || body.content() == null ? "" : body.content().trim();
        if (content.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写回复内容");
        }
        if (content.length() > 1000) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "回复内容最多 1000 字");
        }
        Long replierId = MarketContext.currentUserId();
        UserEntity replier = replierId == null ? null : userMapper.selectById(replierId);
        entity.setStatus(Boolean.TRUE.equals(body.close()) ? "closed" : "replied");
        entity.setReplyContent(content);
        entity.setReplierId(replierId);
        entity.setReplierName(replier == null ? "平台运营"
                : (replier.getNickname() == null ? replier.getUsername() : replier.getNickname()));
        entity.setReplyTime(LocalDateTime.now());
        userFeedbackMapper.updateById(entity);
        notifySubmitter(entity, content);
        return ApiResponse.ok();
    }

    /**
     * 回复后给提交人写站内信。
     *
     * <p>失败只记日志不抛 —— 回复本身已经落库了，不能因为发消息失败把业务回滚。</p>
     */
    private void notifySubmitter(UserFeedbackEntity entity, String reply) {
        try {
            messageFacade.notify(entity.getUserId(), entity.getMarketId(),
                    "您的反馈已收到回复",
                    String.format("「%s」：%s", entity.getTitle(), reply));
        } catch (RuntimeException e) {
            log.warn("发送反馈回复站内信失败（不影响回复本身）：{}", e.getMessage());
        }
    }

    /** 状态/类型筛选：空与 all 都表示不过滤 */
    private boolean hasValue(String value) {
        return value != null && !value.isBlank() && !"all".equalsIgnoreCase(value);
    }

    /** 回复入参；close=true 表示回复后直接关闭 */
    public record ReplyRequest(String content, Boolean close) {
    }
}
