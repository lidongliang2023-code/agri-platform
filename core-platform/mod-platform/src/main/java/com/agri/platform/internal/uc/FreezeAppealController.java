package com.agri.platform.internal.uc;

import com.agri.platform.internal.account.UserOperationLogService;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 冻结申诉（**免登录**）。
 *
 * <p>为什么必须免登录：账号被冻结后 {@code platform_user.status=0}，登录直接被拒
 * （{@code ErrorCode.USER_DISABLED}）。如果申诉也要登录，就等于"被冻结的人永远没机会申诉" ——
 * 那这个申诉入口还不如不做。</p>
 *
 * <p>凭手机号识别身份，不加短信验证码：验证码通道未配置时会把整条路堵死，
 * 而申诉本身不涉及敏感数据（只写一条申诉理由，运营还要人工复核）。
 * 代价是知道手机号的人可以代为提交申诉 —— 这最多造成一条待处理的申诉，
 * 不会解封、不会泄露账号内容，风险可接受。<b>未做频率限制</b>，接入公网前应补。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/sso")
@RequiredArgsConstructor
public class FreezeAppealController {

    private final UserMapper userMapper;
    private final AccountFreezeMapper freezeMapper;
    private final UserOperationLogService operationLog;

    /**
     * 提交冻结申诉。
     *
     * <p>返回里带冻结类型与冻结时间，让用户知道自己在对什么提出异议；
     * 不返回运营内部的完整冻结原因（可能含内部备注）。</p>
     */
    @PostMapping("/freeze-appeal")
    public ApiResponse<Map<String, Object>> submit(@Valid @RequestBody AppealRequest req) {
        String phone = req.phone() == null ? "" : req.phone().trim();
        if (!phone.matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写正确的 11 位手机号");
        }
        String reason = req.reason() == null ? "" : req.reason().trim();
        if (reason.length() < 5) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请把申诉理由写清楚（至少 5 个字），便于运营复核");
        }
        if (reason.length() > 500) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "申诉理由过长，请控制在 500 字以内");
        }

        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getPhone, phone)
                .last("LIMIT 1"));
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "该手机号没有注册记录");
        }

        List<AccountFreezeEntity> frozen = freezeMapper.selectList(
                new LambdaQueryWrapper<AccountFreezeEntity>()
                        .eq(AccountFreezeEntity::getUserId, user.getId())
                        .eq(AccountFreezeEntity::getStatus, "frozen")
                        .orderByDesc(AccountFreezeEntity::getId));
        if (frozen.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该手机号当前没有被冻结的账号，无需申诉");
        }
        AccountFreezeEntity record = frozen.get(0);
        if ("appealing".equals(record.getAppealStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "已有一条申诉在处理中，请耐心等待结果");
        }

        // 驳回后重提：必须把上一次的处理时间与意见**显式置 NULL**。
        // 不能用 updateById —— MyBatis-Plus 默认 updateStrategy=NOT_NULL，
        // 会把 null 字段直接跳过，结果是"状态回到申诉中，但处理时间还留着上次的"，
        // 运营看到会以为已经处理过。
        freezeMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<AccountFreezeEntity>()
                .eq(AccountFreezeEntity::getId, record.getId())
                .set(AccountFreezeEntity::getAppealStatus, "appealing")
                .set(AccountFreezeEntity::getAppealReason, reason)
                .set(AccountFreezeEntity::getAppealTime, LocalDateTime.now())
                .set(AccountFreezeEntity::getAppealHandleTime, null)
                .set(AccountFreezeEntity::getAppealRemark, null));

        // 记在用户自己的操作日志里：他解封后能在「账号安全 · 操作日志」看到自己申诉过
        operationLog.record(user.getId(), "uc.appeal.submit", "提交冻结申诉",
                "冻结记录 " + record.getId(), reason);

        log.info("冻结申诉已受理：user={} freezeId={}", user.getId(), record.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("freezeType", record.getFreezeType());
        result.put("freezeTime", record.getFreezeTime());
        result.put("message", "申诉已提交，运营会在 1-3 个工作日内复核，结果将以站内信通知");
        return ApiResponse.ok(result);
    }

    public record AppealRequest(@NotBlank String phone, @NotBlank String reason) {
    }
}
