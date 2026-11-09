package com.agri.platform.internal.uc;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 账号侧策略（注册 / 密码 / 验证码 / 会话）的**执行入口**。
 *
 * <p>为什么需要这一层：{@code platform_uc_system_config} 让运营能在页面上改配置，
 * 但如果注册、密码校验这些地方还在读代码里的常量，改完不会生效 ——
 * 那比没有配置页更让人困惑。所以这里把配置读出来，交给真正的校验点调用。</p>
 *
 * <p><b>缓存</b>：注册/登录是高频路径，不能每次都查库。用一个 30 秒 TTL 的快照；
 * 运营保存配置时由 {@code UserCenterPolicyController} 显式 {@link #invalidate()}，
 * 所以"改完立刻生效"在单实例上是成立的，多实例最多延迟 30 秒。</p>
 *
 * <p><b>没接管的配置</b>：令牌有效期（{@code session.idle.minutes}）、异地二次验证、
 * 手机号/IP 注册上限、失败锁定等仍在代码或 {@code core-infra} 里，本服务不假装接管 ——
 * 页面会标注哪些真正生效。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountPolicyService {

    /** 注册开关：开放 / 邀请制 / 暂停 */
    public static final String MODE_OPEN = "open";
    public static final String MODE_INVITE = "invt";
    public static final String MODE_CLOSED = "closed";

    /** 密码策略 */
    public static final String PWD_LETTER_DIGIT = "letter_digit";
    public static final String PWD_MIX_DIGIT = "mix_digit";
    public static final String PWD_MIX_SPECIAL = "mix_special";

    private static final long CACHE_TTL_MILLIS = 30_000L;
    private static final Pattern SPECIAL = Pattern.compile("[^A-Za-z0-9]");
    private static final Pattern UPPER = Pattern.compile("[A-Z]");
    private static final Pattern LOWER = Pattern.compile("[a-z]");
    private static final Pattern DIGIT = Pattern.compile("\\d");
    private static final Pattern BIRTHDAY = Pattern.compile("(19|20)\\d{6}");

    private final SystemConfigMapper configMapper;

    private volatile Map<String, String> snapshot;
    private volatile long loadedAt;

    /** 配置保存后调用：下一次读取重新查库。 */
    public void invalidate() {
        snapshot = null;
        loadedAt = 0L;
    }

    // ==================== 读取 ====================

    private Map<String, String> values() {
        Map<String, String> current = snapshot;
        if (current != null && System.currentTimeMillis() - loadedAt < CACHE_TTL_MILLIS) {
            return current;
        }
        synchronized (this) {
            if (snapshot != null && System.currentTimeMillis() - loadedAt < CACHE_TTL_MILLIS) {
                return snapshot;
            }
            Map<String, String> loaded = new LinkedHashMap<>();
            try {
                List<SystemConfigEntity> list = configMapper.selectList(
                        new LambdaQueryWrapper<SystemConfigEntity>());
                for (SystemConfigEntity entity : list) {
                    loaded.put(entity.getConfigKey(), entity.getConfigValue());
                }
            } catch (RuntimeException e) {
                // 配置表读不到不能让注册登录整体不可用：退回空表 = 走默认值
                log.warn("读取账号侧配置失败，本次使用默认策略：{}", e.getMessage());
            }
            snapshot = loaded;
            loadedAt = System.currentTimeMillis();
            return loaded;
        }
    }

    private String text(String key, String fallback) {
        String value = values().get(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private int number(String key, int fallback) {
        try {
            return Integer.parseInt(text(key, String.valueOf(fallback)));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private boolean flag(String key, boolean fallback) {
        String value = text(key, fallback ? "1" : "0");
        return "1".equals(value) || "true".equalsIgnoreCase(value);
    }

    public String registerMode() {
        return text("register.mode", MODE_OPEN);
    }

    public Set<String> registerChannels() {
        String raw = text("register.channels", "phone,wechat");
        Set<String> set = new LinkedHashSet<>();
        Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .forEach(set::add);
        return set;
    }

    /** 新用户默认身份：NONE（无身份，需申请）/ FARMER（农户免审）。 */
    public String defaultRole() {
        return text("register.default.role", "FARMER");
    }

    public String passwordPolicy() {
        return text("password.policy", PWD_LETTER_DIGIT);
    }

    public boolean weakPasswordBlocked() {
        return flag("password.weak.block", true);
    }

    public int rememberDays() {
        return Math.max(number("session.remember.days", 7), 1);
    }

    public int smsCodeTtlSeconds() {
        return Math.max(number("captcha.sms.ttl", 300), 30);
    }

    /**
     * 同一手机号、同一场景的当日发码上限。
     *
     * <p>{@code captcha.sms.daily.limit} 这条配置自 V52 起就在库里，运营端也能改，
     * 但服务侧从来没读它 —— 配置页改了没东西执行，比没有配置更误导人。这里把它接上。</p>
     */
    public int smsDailyLimit() {
        return Math.max(number("captcha.sms.daily.limit", 10), 1);
    }

    // ==================== 执行 ====================

    /**
     * 注册前置校验：开关 + 注册方式。
     *
     * @param channel 本次注册使用的渠道（phone / wechat / email / credit）
     */
    public void assertRegistrationAllowed(String channel) {
        String mode = registerMode();
        if (MODE_CLOSED.equals(mode)) {
            throw new BusinessException(ErrorCode.BIZ_ERROR, "平台已暂停新用户注册，如有需要请联系运营");
        }
        if (MODE_INVITE.equals(mode)) {
            // 邀请制需要邀请码字段，当前注册接口没有这个入参 ——
            // 与其静默放行（等于没做邀请制），不如明确拒绝并说清楚原因
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "当前为邀请制注册：请通过运营发放的邀请链接注册，或联系运营开通");
        }
        Set<String> channels = registerChannels();
        if (!channels.isEmpty() && channel != null && !channels.contains(channel)) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "平台当前不开放「" + channelLabel(channel) + "」注册，可选方式："
                            + String.join("、", channels.stream().map(this::channelLabel).toList()));
        }
    }

    private String channelLabel(String channel) {
        return switch (channel) {
            case "phone" -> "手机号";
            case "wechat" -> "微信授权";
            case "email" -> "邮箱";
            case "credit" -> "企业工商注册号";
            default -> channel;
        };
    }

    /**
     * 密码校验：复杂度 + 弱口令。
     *
     * <p>两个校验都失败时优先报复杂度（用户先得知道格式要求）。</p>
     *
     * @param raw   明文密码
     * @param phone 账号手机号（用于识别"密码就是手机号"这类弱口令，可空）
     */
    public void validatePassword(String raw, String phone) {
        String policy = passwordPolicy();
        String password = raw == null ? "" : raw;

        int min;
        int max;
        StringBuilder rule = new StringBuilder();
        switch (policy) {
            case PWD_MIX_SPECIAL -> {
                min = 12;
                max = 32;
                rule.append("12-32 位，同时包含大小写字母、数字和特殊字符");
            }
            case PWD_MIX_DIGIT -> {
                min = 8;
                max = 20;
                rule.append("8-20 位，同时包含大小写字母和数字");
            }
            default -> {
                min = 8;
                max = 20;
                rule.append("8-20 位，同时包含字母和数字");
            }
        }

        if (password.length() < min || password.length() > max) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "密码应为" + rule);
        }
        boolean ok = switch (policy) {
            case PWD_MIX_SPECIAL -> UPPER.matcher(password).find() && LOWER.matcher(password).find()
                    && DIGIT.matcher(password).find() && SPECIAL.matcher(password).find();
            case PWD_MIX_DIGIT -> UPPER.matcher(password).find() && LOWER.matcher(password).find()
                    && DIGIT.matcher(password).find();
            default -> password.chars().anyMatch(Character::isLetter)
                    && DIGIT.matcher(password).find();
        };
        if (!ok) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "密码应为" + rule);
        }

        if (weakPasswordBlocked()) {
            String reason = weakReason(password, phone);
            if (reason != null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "密码过于简单：" + reason);
            }
        }
    }

    /** 弱口令识别。返回 null 表示通过。 */
    private String weakReason(String password, String phone) {
        // 1. 全部同一个字符（aaaaaaaa）
        if (password.chars().distinct().count() == 1) {
            return "不能全部是同一个字符";
        }
        // 2. 连续 4 位顺增或顺减（1234 / abcd / 4321）
        if (hasSequential(password, 4)) {
            return "不能包含 4 位以上连续字符（如 1234、abcd）";
        }
        // 3. 与手机号高度相关
        if (phone != null && phone.length() >= 8) {
            String tail = phone.substring(phone.length() - 8);
            if (password.contains(tail) || password.contains(phone)) {
                return "不能包含手机号";
            }
        }
        // 4. 形如生日（19xx/20xx + 4 位）
        if (BIRTHDAY.matcher(password).find()) {
            return "不能使用生日";
        }
        return null;
    }

    private boolean hasSequential(String password, int span) {
        int run = 1;
        int direction = 0;
        for (int i = 1; i < password.length(); i++) {
            int delta = password.charAt(i) - password.charAt(i - 1);
            if (delta == 1 || delta == -1) {
                if (direction == 0 || direction == delta) {
                    direction = delta;
                    run++;
                    if (run >= span) {
                        return true;
                    }
                } else {
                    direction = delta;
                    run = 2;
                }
            } else {
                run = 1;
                direction = 0;
            }
        }
        return false;
    }
}
