package com.agri.platform.internal.uc;

import com.agri.platform.internal.account.UserOperationLogService;
import com.agri.platform.internal.auth.AuthService;
import com.agri.platform.internal.message.MessageEntity;
import com.agri.platform.internal.message.MessageMapper;
import com.agri.platform.internal.sso.SsoSessionService;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户中心运营端 · 账号处置动作（会话 / 强制下线 / 重置密码）。
 *
 * <p>为什么单独一个控制器：这里全是**对某个具体账号动手**的接口，
 * 和 {@code UserCenterOpsController}（只读报表）与 {@code UserCenterPolicyController}
 * （全局策略）不是一类东西。放在一起会让"哪些接口动了别人的账号"很难一眼看出。</p>
 *
 * <p><b>全部复用既有基础设施，不重造</b>：
 * 会话吊销走 {@code AuthService.revokeAllSessions} + {@code SsoSessionService.revokeAllForUser}
 * （登出、改密码用的就是这两个），会话列表走 {@code SsoSessionService.listSessions}。
 * 这两个方法当初就是为"安全事件"准备的，运营端只是多一个调用方。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/uc")
@RequiredArgsConstructor
public class UserCenterActionController {

    /** 临时密码字符集：剔除 0/O/1/l/I 这类易混字符，减少"抄错密码"的工单 */
    private static final String LOWER = "abcdefghijkmnpqrstuvwxyz";
    private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String DIGIT = "23456789";
    private static final String SPECIAL = "!@#$%^&*";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserMapper userMapper;
    private final MessageMapper messageMapper;
    private final SsoSessionService sessionService;
    private final AuthService authService;
    private final UserOperationLogService operationLog;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ==================== 会话 ====================

    /**
     * 该账号当前的活跃会话（设备 / IP / 登录时间）。
     *
     * <p>运营判断"是不是被盗"时要看这个：同一账号十分钟内从三个省登录，基本可以确定。
     * 直接复用用户端「登录设备」的同一个方法，两边口径一致 —— 否则会出现
     * "用户说有三台设备、运营说只有一台"这种没法对账的情况。</p>
     */
    @GetMapping("/users/{id}/sessions")
    public ApiResponse<List<Map<String, Object>>> sessions(@PathVariable Long id) {
        UserEntity user = requireUser(id);
        // currentSid 传 null：运营端不是这个账号的会话，没有"本机"可标
        List<Map<String, Object>> rows = sessionService.listSessions(user.getId(), null);
        return ApiResponse.ok(rows);
    }

    /**
     * 强制下线：吊销该账号全部会话与令牌。
     *
     * <p>两件事都要做，缺一不可：
     * 只吊销访问令牌 → 旧的 SSO Cookie 还能通过授权端点换一枚新的；
     * 只清 SSO 会话 → 手里已经发出的访问令牌仍然有效到过期。</p>
     */
    @PostMapping("/users/{id}/force-logout")
    public ApiResponse<Map<String, Object>> forceLogout(@PathVariable Long id) {
        UserEntity user = requireUser(id);
        int sessions = sessionService.revokeAllForUser(user.getId());
        authService.revokeAllSessions(user.getId());

        audit("uc.user.force-logout", "强制下线", user.getUsername(),
                "清理会话 " + sessions + " 个，并吊销全部令牌");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessions", sessions);
        result.put("message", sessions == 0
                ? "该账号当前没有活跃会话，已吊销全部令牌"
                : "已下线 " + sessions + " 个会话，并吊销全部令牌");
        return ApiResponse.ok(result);
    }

    // ==================== 重置密码 ====================

    /**
     * 运营重置密码：生成一次性临时密码，返回给操作人转告本人。
     *
     * <p>同时做三件事：改密码、吊销全部会话（旧密码登录的会话不能留）、
     * 给用户发一条站内信告知。临时密码**只在这里返回一次**，不落库、不记审计详情。</p>
     *
     * <p><b>已知缺口</b>：没有"首次登录必须改密"的强制 —— 平台没有这个标记位。
     * 所以临时密码本质上是一个"运营知道的新密码"，页面会提示必须通过安全渠道转告，
     * 并建议用户登录后立即自行修改。</p>
     */
    @PostMapping("/users/{id}/reset-password")
    public ApiResponse<Map<String, Object>> resetPassword(@PathVariable Long id) {
        UserEntity user = requireUser(id);
        String temp = tempPassword();
        user.setPassword(passwordEncoder.encode(temp));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);

        int sessions = sessionService.revokeAllForUser(user.getId());
        authService.revokeAllSessions(user.getId());

        // 通知本人：站内信里不写密码，只写"已被重置"——站内信是可被他人看到的
        MessageEntity message = new MessageEntity();
        message.setUserId(user.getId());
        message.setTitle("登录密码已被运营重置");
        message.setContent("你的登录密码已由平台运营重置，请使用运营提供的临时密码登录，并立即在「账号安全」中修改为自己的密码。如非本人申请，请联系客服。");
        message.setReadFlag(0);
        // UserEntity 是全局表（没有 market_id 字段），市场维度由 MyMetaObjectHandler
        // 从当前会话自动填充，这里不手工设置
        messageMapper.insert(message);

        // 审计只记"重置了谁的密码"，不记密码本身
        audit("uc.user.reset-password", "重置登录密码", user.getUsername(),
                "临时密码已下发，清理会话 " + sessions + " 个");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tempPassword", temp);
        result.put("sessions", sessions);
        result.put("message", "密码已重置，临时密码仅显示这一次，请通过安全渠道转告本人");
        return ApiResponse.ok(result);
    }

    // ==================== 内部 ====================

    private UserEntity requireUser(Long id) {
        UserEntity user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    /**
     * 生成临时密码：16 位，四类字符各至少一个。
     *
     * <p>长度与字符类别覆盖平台所有密码策略（最严的是 12-32 位含大小写+数字+特殊字符），
     * 这样运营改过策略也不会出现"临时密码不符合本平台规则"的尴尬。</p>
     */
    private String tempPassword() {
        char[] chars = new char[16];
        int index = 0;
        chars[index++] = LOWER.charAt(RANDOM.nextInt(LOWER.length()));
        chars[index++] = UPPER.charAt(RANDOM.nextInt(UPPER.length()));
        chars[index++] = DIGIT.charAt(RANDOM.nextInt(DIGIT.length()));
        chars[index++] = SPECIAL.charAt(RANDOM.nextInt(SPECIAL.length()));
        String all = LOWER + UPPER + DIGIT + SPECIAL;
        while (index < chars.length) {
            chars[index++] = all.charAt(RANDOM.nextInt(all.length()));
        }
        // 打乱，避免固定位置永远是"小写-大写-数字-符号"，看起来像模板
        for (int i = chars.length - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }

    private void audit(String action, String label, String target, String detail) {
        operationLog.record(com.agri.core.infra.web.MarketContext.currentUserId(), action, label, target, detail);
    }
}
