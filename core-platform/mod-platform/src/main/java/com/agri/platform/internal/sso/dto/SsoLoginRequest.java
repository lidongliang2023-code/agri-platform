package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

// SSO 登录请求：凭据 + 本次授权请求的上下文。
//
// 上下文（client_id / redirect_uri / state / PKCE）随登录页一起带过来，登录成功后由服务端
// 直接签码并回跳；登录页本身不参与签码 —— 前端只负责收集意图与跳转（V2.0 第 5.1 节要点 1）。
public record SsoLoginRequest(
        @NotBlank(message = "用户名不能为空") String username,
        @NotBlank(message = "密码不能为空") String password,
        Long marketId,
        @NotBlank(message = "client_id 不能为空") String clientId,
        @NotBlank(message = "redirect_uri 不能为空") String redirectUri,
        String state,
        String codeChallenge,
        String codeChallengeMethod) {
}
