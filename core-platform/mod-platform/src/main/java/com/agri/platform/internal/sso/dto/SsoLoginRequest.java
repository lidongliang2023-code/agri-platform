package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

// SSO 登录请求：凭据 + 本次授权请求的上下文。
//
// 上下文（client_id / redirect_uri / state / PKCE）随登录页一起带过来，登录成功后由服务端
// 直接签码并回跳；登录页本身不参与签码 —— 前端只负责收集意图与跳转（V2.0 第 5.1 节要点 1）。
public record SsoLoginRequest(
        // 账号标识二选一（2026-10-16 加手机号登录）：username 或 phone，至少一个；
        // 校验交给 AuthService.authenticate（两个字段都可能缺，注解判不了"至少一个"）。
        String username,
        @NotBlank(message = "密码不能为空") String password,
        Long marketId,
        /** 手机号（与 username 二选一；两个都给时以 username 为准） */
        String phone,
        @NotBlank(message = "client_id 不能为空") String clientId,
        @NotBlank(message = "redirect_uri 不能为空") String redirectUri,
        String state,
        String codeChallenge,
        String codeChallengeMethod,
        /** 登录身份 enterprise / personal（2026-10-20 原型字段；为空时不做身份校验） */
        String identity,
        /** 「7 天内自动登录」：true 时会话与 Cookie 用 7 天，否则用平台默认时长 */
        Boolean remember) {

    /** 老调用方（只传 username/password/…）用的便捷构造，保持契约向后兼容。 */
    public SsoLoginRequest(String username, String password, Long marketId, String clientId, String redirectUri,
                           String state, String codeChallenge, String codeChallengeMethod) {
        this(username, password, marketId, null, clientId, redirectUri, state, codeChallenge, codeChallengeMethod,
                null, null);
    }
}
