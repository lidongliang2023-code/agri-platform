package com.agri.platform.internal.auth.dto;

/**
 * 登录响应：短时效访问令牌 + 服务端刷新令牌（旋转）。
 */
public record LoginVO(String accessToken, String refreshToken, long expiresIn, UserVO user) {
}
