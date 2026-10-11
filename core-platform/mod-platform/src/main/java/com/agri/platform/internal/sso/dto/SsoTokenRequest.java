package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

// 授权码换令牌请求（V2.0 第 5.2 节第 ⑥ 步）。
//
// codeVerifier 是 PKCE 的另一半：授权码在浏览器链路上传递可能被截获，
// 但没有 verifier 就换不到令牌。
public record SsoTokenRequest(
        @NotBlank(message = "授权码不能为空") String code,
        @NotBlank(message = "client_id 不能为空") String clientId,
        String codeVerifier) {
}
