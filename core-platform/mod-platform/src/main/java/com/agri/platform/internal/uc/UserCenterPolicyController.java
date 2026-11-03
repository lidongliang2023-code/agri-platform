package com.agri.platform.internal.uc;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.internal.account.UserOperationLogService;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 用户中心运营端 · 策略与处置（第三方授权 / 消息 / 冻结 / 参数配置）。
 *
 * <p>与 {@link UserCenterOpsController} 分开的原因：那个是纯读的报表视图，
 * 这个是**会改状态**的写接口。混在一个类里，评审时很难一眼看出"哪些接口有副作用"。</p>
 *
 * <p><b>副作用都要留痕</b>：审核、冻结、解封、改配置全部写 {@code platform_user_operation_log}，
 * 运营端的「操作审计」页读的就是这些记录 —— 不额外造一套审计表。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/uc")
@RequiredArgsConstructor
public class UserCenterPolicyController {

    private final ThirdPartyAppMapper appMapper;
    private final ThirdPartyAuthRecordMapper authRecordMapper;
    private final MessageTemplateMapper templateMapper;
    private final MessagePushTaskMapper pushTaskMapper;
    private final AccountFreezeMapper freezeMapper;
    private final SystemConfigMapper configMapper;
    private final UserMapper userMapper;
    /** 推送入队与人群解析都在 service 里，控制器不再直接碰站内信与人群表 */
    private final MessagePushService pushService;
    private final UserOperationLogService operationLogService;
    /** 保存配置后要立刻让策略缓存失效，否则运营改完要等 30 秒才生效 */
    private final AccountPolicyService accountPolicy;

    // ==================== 第三方应用 ====================

    @GetMapping("/auth-apps")
    public ApiResponse<PageResult<ThirdPartyAppEntity>> authApps(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {

        LambdaQueryWrapper<ThirdPartyAppEntity> wrapper = new LambdaQueryWrapper<ThirdPartyAppEntity>()
                .and(hasText(keyword), w -> w.like(ThirdPartyAppEntity::getAppName, keyword)
                        .or().like(ThirdPartyAppEntity::getAppKey, keyword)
                        .or().like(ThirdPartyAppEntity::getApplicant, keyword))
                .eq(hasText(status), ThirdPartyAppEntity::getStatus, status)
                .orderByDesc(ThirdPartyAppEntity::getId);
        Page<ThirdPartyAppEntity> page = appMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return ApiResponse.ok(PageResult.of(page.getRecords(), page.getTotal(), pageNum, pageSize));
    }

    /** 应用上架：登记即可，默认 pending，需运营审核后才 online。 */
    @PostMapping("/auth-apps")
    public ApiResponse<ThirdPartyAppEntity> createApp(@Valid @RequestBody CreateAppRequest req) {
        long exists = appMapper.selectCount(new LambdaQueryWrapper<ThirdPartyAppEntity>()
                .eq(ThirdPartyAppEntity::getAppKey, req.appKey()));
        if (exists > 0) {
            throw new BusinessException(ErrorCode.DUPLICATE_KEY, "应用标识已存在");
        }
        ThirdPartyAppEntity entity = new ThirdPartyAppEntity();
        entity.setAppKey(req.appKey());
        entity.setAppName(req.appName());
        entity.setAppType(req.appType() == null ? "partner" : req.appType());
        entity.setApplicant(req.applicant());
        entity.setContactName(req.contactName());
        entity.setContactPhone(req.contactPhone());
        entity.setScopes(req.scopes());
        entity.setRedirectUri(req.redirectUri());
        entity.setStatus("pending");
        entity.setCallCount(0L);
        appMapper.insert(entity);
        audit("uc.auth-app.create", "登记第三方应用", entity.getAppKey(), entity.getAppName());
        return ApiResponse.ok(entity);
    }

    /** 应用审核：通过 → online，驳回 → rejected。 */
    @PostMapping("/auth-apps/{id}/review")
    public ApiResponse<ThirdPartyAppEntity> reviewApp(@PathVariable Long id,
                                                      @RequestBody ReviewRequest req) {
        ThirdPartyAppEntity entity = appMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "应用不存在");
        }
        boolean approved = Boolean.TRUE.equals(req.approved());
        entity.setStatus(approved ? "online" : "rejected");
        entity.setReviewerName(operatorName());
        entity.setReviewTime(LocalDateTime.now());
        entity.setReviewRemark(req.remark());
        appMapper.updateById(entity);
        audit("uc.auth-app.review", approved ? "通过应用上架" : "驳回应用上架",
                entity.getAppKey(), req.remark());
        return ApiResponse.ok(entity);
    }

    @GetMapping("/auth-records")
    public ApiResponse<PageResult<ThirdPartyAuthRecordEntity>> authRecords(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<ThirdPartyAuthRecordEntity> wrapper =
                new LambdaQueryWrapper<ThirdPartyAuthRecordEntity>()
                        .and(hasText(keyword), w -> w.like(ThirdPartyAuthRecordEntity::getUserName, keyword)
                                .or().like(ThirdPartyAuthRecordEntity::getAppName, keyword))
                        .orderByDesc(ThirdPartyAuthRecordEntity::getId);
        Page<ThirdPartyAuthRecordEntity> page =
                authRecordMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return ApiResponse.ok(PageResult.of(page.getRecords(), page.getTotal(), pageNum, pageSize));
    }

    // ==================== 消息模板 ====================

    @GetMapping("/message-templates")
    public ApiResponse<List<MessageTemplateEntity>> templates(
            @RequestParam(required = false) String scene) {
        return ApiResponse.ok(templateMapper.selectList(new LambdaQueryWrapper<MessageTemplateEntity>()
                .eq(hasText(scene), MessageTemplateEntity::getScene, scene)
                .orderByAsc(MessageTemplateEntity::getScene)
                .orderByAsc(MessageTemplateEntity::getId)));
    }

    @PostMapping("/message-templates")
    public ApiResponse<MessageTemplateEntity> createTemplate(@Valid @RequestBody TemplateRequest req) {
        long exists = templateMapper.selectCount(new LambdaQueryWrapper<MessageTemplateEntity>()
                .eq(MessageTemplateEntity::getCode, req.code()));
        if (exists > 0) {
            throw new BusinessException(ErrorCode.DUPLICATE_KEY, "模板编码已存在");
        }
        MessageTemplateEntity entity = new MessageTemplateEntity();
        entity.setCode(req.code());
        entity.setScene(req.scene());
        entity.setChannels(req.channels());
        entity.setTitle(req.title());
        entity.setContent(req.content());
        entity.setVariables(req.variables());
        entity.setStatus(req.status() == null ? "enabled" : req.status());
        templateMapper.insert(entity);
        audit("uc.template.create", "新建消息模板", entity.getCode(), entity.getTitle());
        return ApiResponse.ok(entity);
    }

    @PutMapping("/message-templates/{id}")
    public ApiResponse<MessageTemplateEntity> updateTemplate(@PathVariable Long id,
                                                            @Valid @RequestBody TemplateRequest req) {
        MessageTemplateEntity entity = templateMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "模板不存在");
        }
        entity.setScene(req.scene());
        entity.setChannels(req.channels());
        entity.setTitle(req.title());
        entity.setContent(req.content());
        entity.setVariables(req.variables());
        if (req.status() != null) {
            entity.setStatus(req.status());
        }
        templateMapper.updateById(entity);
        audit("uc.template.update", "修改消息模板", entity.getCode(), entity.getTitle());
        return ApiResponse.ok(entity);
    }

    // ==================== 消息推送 ====================

    @GetMapping("/message-pushes")
    public ApiResponse<PageResult<MessagePushTaskEntity>> pushes(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize) {
        Page<MessagePushTaskEntity> page = pushTaskMapper.selectPage(new Page<>(pageNum, pageSize),
                new LambdaQueryWrapper<MessagePushTaskEntity>()
                        .orderByDesc(MessagePushTaskEntity::getId));
        return ApiResponse.ok(PageResult.of(page.getRecords(), page.getTotal(), pageNum, pageSize));
    }

    /**
     * 新建推送任务（立即返回，投递交给后台 worker）。
     *
     * <p>以前是请求里同步循环插站内信、还有 2000 人硬上限：再多会超时，
     * 而超时不会回滚已插入的站内信 —— 用户收到一半、运营看到 500。
     * 现在只做「建任务 + 校验」，人群解析与分批投递由 {@code MessagePushWorker} 完成。</p>
     *
     * <p>返回的 {@code status=queued} 表示已入队；前端轮询任务列表即可看到
     * queued → sending → sent 的进度。</p>
     */
    @PostMapping("/message-pushes")
    public ApiResponse<Map<String, Object>> push(@Valid @RequestBody PushRequest req) {
        if (!hasText(req.title()) && !hasText(req.templateCode())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写消息标题，或选择一个消息模板");
        }
        String title = req.title();
        String content = req.content() == null ? "" : req.content();
        if (hasText(req.templateCode())) {
            MessageTemplateEntity template = templateMapper.selectOne(
                    new LambdaQueryWrapper<MessageTemplateEntity>()
                            .eq(MessageTemplateEntity::getCode, req.templateCode()));
            if (template != null) {
                if (!hasText(title)) {
                    title = template.getTitle();
                }
                if (!hasText(content)) {
                    content = template.getContent();
                }
            }
        }
        if (!hasText(title)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板未提供标题，请手动填写");
        }

        Long taskId = pushService.enqueue(title, content, req.templateCode(), req.audience(),
                req.channels(), operatorName());
        audit("uc.push.send", "新建消息推送", title, "任务 " + taskId + "，人群 " + req.audience());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", String.valueOf(taskId));
        result.put("status", MessagePushService.STATUS_QUEUED);
        result.put("message", "已加入推送队列，后台按批投递，可在下方任务列表查看进度");
        return ApiResponse.ok(result);
    }

    /**
     * 预估触达人数：发之前先让人知道会发给谁，避免"手滑全量群发"。
     */
    @GetMapping("/message-pushes/audience-count")
    public ApiResponse<Map<String, Object>> audienceCount(
            @RequestParam(defaultValue = "all") String audience) {
        int count = pushService.countAudience(audience);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("audience", audience);
        result.put("count", count);
        return ApiResponse.ok(result);
    }

    // ==================== 账号冻结 ====================

    @GetMapping("/freeze-records")
    public ApiResponse<PageResult<Map<String, Object>>> freezeRecords(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String appealStatus) {
        LambdaQueryWrapper<AccountFreezeEntity> wrapper = new LambdaQueryWrapper<AccountFreezeEntity>()
                .eq(hasText(status), AccountFreezeEntity::getStatus, status)
                .eq(hasText(appealStatus), AccountFreezeEntity::getAppealStatus, appealStatus)
                .and(hasText(keyword), w -> w.like(AccountFreezeEntity::getUsername, keyword)
                        .or().like(AccountFreezeEntity::getReason, keyword)
                        .or().like(AccountFreezeEntity::getAppealReason, keyword))
                // 申诉中的排前面：运营打开页面先看到要处理的
                .orderByDesc(AccountFreezeEntity::getAppealTime)
                .orderByDesc(AccountFreezeEntity::getId);
        Page<AccountFreezeEntity> page = freezeMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (AccountFreezeEntity f : page.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(f.getId()));
            row.put("userId", String.valueOf(f.getUserId()));
            row.put("username", f.getUsername());
            row.put("freezeType", f.getFreezeType());
            row.put("reason", f.getReason());
            row.put("freezeTime", f.getFreezeTime());
            row.put("expireTime", f.getExpireTime());
            row.put("status", f.getStatus());
            row.put("appealStatus", f.getAppealStatus());
            row.put("operatorName", f.getOperatorName());
            row.put("unfreezeTime", f.getUnfreezeTime());
            row.put("appealReason", f.getAppealReason());
            row.put("appealTime", f.getAppealTime());
            row.put("appealHandleTime", f.getAppealHandleTime());
            row.put("appealRemark", f.getAppealRemark());
            rows.add(row);
        }
        return ApiResponse.ok(PageResult.of(rows, page.getTotal(), pageNum, pageSize));
    }

    /**
     * 手动冻结。
     *
     * <p>同时改两处：本表记"为什么冻"，{@code platform_user.status} 记"现在不能登录"。
     * 只改一处会出现"记录说冻了、人还能登"或反之。</p>
     */
    @PostMapping("/freeze-records")
    public ApiResponse<AccountFreezeEntity> freeze(@Valid @RequestBody FreezeRequest req) {
        UserEntity user = userMapper.selectById(req.userId());
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        AccountFreezeEntity active = freezeMapper.selectOne(new LambdaQueryWrapper<AccountFreezeEntity>()
                .eq(AccountFreezeEntity::getUserId, req.userId())
                .eq(AccountFreezeEntity::getStatus, "frozen")
                .last("LIMIT 1"));
        if (active != null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该账号已在冻结中");
        }

        AccountFreezeEntity entity = new AccountFreezeEntity();
        entity.setUserId(user.getId());
        entity.setUsername(user.getUsername());
        entity.setFreezeType(req.freezeType() == null ? "risk" : req.freezeType());
        entity.setReason(req.reason());
        entity.setFreezeTime(LocalDateTime.now());
        entity.setExpireTime(req.expireTime());
        entity.setStatus("frozen");
        entity.setAppealStatus("none");
        entity.setOperatorName(operatorName());
        freezeMapper.insert(entity);

        user.setStatus(0);
        userMapper.updateById(user);
        audit("uc.freeze", "冻结账号", user.getUsername(), req.reason());
        return ApiResponse.ok(entity);
    }

    /** 解封：改记录状态 + 恢复 user.status。 */
    @PostMapping("/freeze-records/{id}/unfreeze")
    public ApiResponse<AccountFreezeEntity> unfreeze(@PathVariable Long id,
                                                     @RequestBody(required = false) ReviewRequest req) {
        AccountFreezeEntity entity = freezeMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "冻结记录不存在");
        }
        if (!"frozen".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该记录已解封");
        }
        applyUnfreeze(entity, req == null ? null : req.remark());
        audit("uc.unfreeze", "解封账号", entity.getUsername(),
                req == null ? null : req.remark());
        return ApiResponse.ok(entity);
    }

    /**
     * 处理冻结申诉。
     *
     * <p>受理即解封（用户申诉的核心诉求就是恢复使用），驳回则保持冻结。
     * 两种情况都记处理时间与意见 —— 驳回理由会作为用户端的答复内容，
     * 不写理由的驳回等于"不告诉你为什么"，这类工单会立刻变成二次申诉。</p>
     */
    @PostMapping("/freeze-records/{id}/appeal")
    public ApiResponse<Map<String, Object>> handleAppeal(@PathVariable Long id,
                                                         @RequestBody ReviewRequest req) {
        AccountFreezeEntity entity = freezeMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "冻结记录不存在");
        }
        if (!"appealing".equals(entity.getAppealStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该记录没有待处理的申诉");
        }
        boolean accepted = Boolean.TRUE.equals(req.approved());
        String remark = req.remark();
        if (!accepted && !hasText(remark)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "驳回申诉必须填写理由，用户需要知道为什么");
        }

        entity.setAppealStatus(accepted ? "accepted" : "rejected");
        entity.setAppealHandleTime(LocalDateTime.now());
        entity.setAppealRemark(remark);

        if (accepted) {
            // 受理 = 解封：复用同一段逻辑，避免两处各写一遍导致状态不一致
            applyUnfreeze(entity, "申诉受理：" + (hasText(remark) ? remark : "复核后解除冻结"));
        } else {
            freezeMapper.updateById(entity);
        }

        audit(accepted ? "uc.appeal.accept" : "uc.appeal.reject",
                accepted ? "受理冻结申诉" : "驳回冻结申诉",
                entity.getUsername(), remark);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accepted", accepted);
        result.put("message", accepted
                ? "已受理申诉并解封该账号"
                : "已驳回申诉，账号保持冻结");
        return ApiResponse.ok(result);
    }

    /**
     * 解封的统一执行点：记录状态 + 恢复 user.status。
     *
     * <p>抽出来是因为「直接解封」和「申诉受理」都要做这两步 ——
     * 复制一遍就会出现"某天只改了一处"的经典问题。</p>
     */
    private void applyUnfreeze(AccountFreezeEntity entity, String remark) {
        entity.setStatus("unfrozen");
        entity.setUnfreezeTime(LocalDateTime.now());
        entity.setUnfreezeRemark(remark);
        freezeMapper.updateById(entity);

        UserEntity user = userMapper.selectById(entity.getUserId());
        if (user != null) {
            user.setStatus(1);
            userMapper.updateById(user);
        }
    }

    // ==================== 参数配置 ====================

    @GetMapping("/configs")
    public ApiResponse<List<SystemConfigEntity>> configs() {
        return ApiResponse.ok(configMapper.selectList(new LambdaQueryWrapper<SystemConfigEntity>()
                .orderByAsc(SystemConfigEntity::getConfigGroup)
                .orderByAsc(SystemConfigEntity::getSortNo)));
    }

    /** 批量保存配置。整组提交，避免"改了一半"的半成品状态。 */
    @PutMapping("/configs")
    public ApiResponse<Map<String, Object>> saveConfigs(@RequestBody List<ConfigItem> items) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "没有要保存的配置");
        }
        int changed = 0;
        for (ConfigItem item : items) {
            SystemConfigEntity entity = configMapper.selectOne(new LambdaQueryWrapper<SystemConfigEntity>()
                    .eq(SystemConfigEntity::getConfigKey, item.key()));
            if (entity == null) {
                continue;
            }
            if (!Objects.equals(entity.getConfigValue(), item.value())) {
                entity.setConfigValue(item.value());
                configMapper.updateById(entity);
                changed++;
            }
        }
        // 关键：让策略缓存立刻失效，否则"保存了但注册行为没变"要等 30 秒才自愈
        accountPolicy.invalidate();
        audit("uc.config.update", "修改账号侧参数", "platform_uc_system_config", "变更 " + changed + " 项");
        return ApiResponse.ok(Map.of("changed", changed, "message", "已保存 " + changed + " 项配置"));
    }

    // ==================== 内部 ====================

    private void audit(String action, String label, String target, String detail) {
        operationLogService.record(MarketContext.currentUserId(), action, label, target, detail);
    }

    private String operatorName() {
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return "系统";
        }
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            return "系统";
        }
        return user.getNickname() == null ? user.getUsername() : user.getNickname();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    // ==================== 请求体 ====================

    public record CreateAppRequest(@NotBlank String appKey, @NotBlank String appName,
                                   String appType, String applicant, String contactName,
                                   String contactPhone, String scopes, String redirectUri) {
    }

    /** 审核/解封共用的意见体。用 record 而不是 @Data：Jackson 对 record 走构造器， */
    /** 字段少时不必再写一堆 setter，也避免"getXxx 还是 xxx()"这种访问器错用。 */
    public record ReviewRequest(Boolean approved, String remark) {
    }

    public record TemplateRequest(@NotBlank String code, @NotBlank String scene, String channels,
                                  @NotBlank String title, String content, String variables,
                                  String status) {
    }

    /**
     * 推送请求。
     *
     * <p>{@code title} 故意不加 {@code @NotBlank}：选了模板时标题与正文由模板带出，
     * 校验注解会在方法体执行前就抛 400，把"选模板、不填标题"这个最自然的用法挡死。</p>
     */
    public record PushRequest(String title, String content, String templateCode,
                              String audience, String channels) {
    }

    public record FreezeRequest(@jakarta.validation.constraints.NotNull Long userId, String freezeType,
                                String reason, LocalDateTime expireTime) {
    }

    public record ConfigItem(String key, String value) {
    }
}
