package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 手机号验证码注册请求（2026-10-16）：注册成功即按同一授权上下文登录（签码回跳），
 * 用户不必再登一次。

 *
 * @param phone 手机号（同时作为登录账号名）
 * @param code 短信验证码（场景 register）
 * @param nickname 昵称（可空）
 * @param marketId 进入的市场（缺省 1）
 * @param clientId 子系统标识
 * @param redirectUri 回跳地址
 * @param state 透传状态
 * @param codeChallenge PKCE challenge
 * @param codeChallengeMethod PKCE 方法
 */
public record SmsRegisterRequest(
        @NotBlank(message = "手机号不能为空") String phone,
        @NotBlank(message = "验证码不能为空") String code,
        String nickname,
        Long marketId,
        @NotBlank(message = "client_id 不能为空") String clientId,
        @NotBlank(message = "redirect_uri 不能为空") String redirectUri,
        String state,
        String codeChallenge,
        String codeChallengeMethod) {
}
