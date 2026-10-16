package com.agri.platform.internal.auth.dto;

/**
 * 登录请求：用户选择进入的市场（ADR-005 用户×角色×市场）。

 *
 * <p><b>账号标识二选一</b>（2026-10-16 加手机号登录）：{@code username} 账号 或 {@code phone} 手机号，
 * 两者至少给一个 —— 手机号是"没记住用户名也能登"的入口，账号仍是主键级标识（超管这类账号没有手机号）。
 * 校验从 {@code @NotBlank} 挪到服务层：两个字段都可能缺，靠注解判不了"至少一个"。</p>
 */
public record LoginRequest(
        String username,
        String password,
        Long marketId,
        /** 手机号（与 username 二选一；两个都给时以 username 为准） */
        String phone) {

    /** 老调用方（只传 username/password/marketId）用的便捷构造。 */
    public LoginRequest(String username, String password, Long marketId) {
        this(username, password, marketId, null);
    }
}
