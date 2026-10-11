package com.agri.platform.internal.auth.dto;

/**
 * 登录 / 刷新响应：短时效访问令牌 + 用户信息。
 *
 * <p><b>刷新令牌不在本响应体内</b>（2026-10-11 起）。依据 V2.0 第 4.3 节
 * 「Access Token 存内存（或短时 sessionStorage），Refresh Token 经 HttpOnly Cookie/安全存储；
 * 不写入 localStorage 长期留存敏感凭证」：刷新令牌一旦进入 JSON，前端就能把它写进
 * localStorage，规范即被绕过。现由服务端直接以 HttpOnly Cookie 下发，见
 * {@code RefreshCookieSupport} 与 {@link com.agri.platform.internal.auth.dto.AuthOutcome}。</p>
 */
public record LoginVO(String accessToken, long expiresIn, UserVO user) {
}
