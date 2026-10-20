package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 手机验证码登录请求（2026-10-16）：凭据是「手机号 + 短信验证码」，
 * 其余字段与 {@link SsoLoginRequest} 的授权上下文一致（登录成功后由服务端签码并回跳）。
 *
 * @param phone 手机号
 * @param code 短信验证码
 * @param marketId 进入的市场（缺省 1）
 * @param clientId 子系统标识
 * @param redirectUri 回跳地址
 * @param state 透传状态
 * @param codeChallenge PKCE challenge
 * @param codeChallengeMethod PKCE 方法
 */
public record SmsLoginRequest(
        @NotBlank(message = "手机号不能为空") String phone,
        @NotBlank(message = "验证码不能为空") String code,
        Long marketId,
        @NotBlank(message = "client_id 不能为空") String clientId,
        @NotBlank(message = "redirect_uri 不能为空") String redirectUri,
        String state,
        String codeChallenge,
        String codeChallengeMethod,
        /** 登录身份 enterprise / personal（2026-10-20 原型字段；为空时不做身份校验） */
        String identity,
        /** 「7 天内自动登录」：true 时会话与 Cookie 用 7 天，否则用平台默认时长 */
        Boolean remember) {
}
