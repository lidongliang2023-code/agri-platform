package com.agri.platform.internal.auth.dto;

/**
 * 认证内部传输体：响应体 + 需要写入 HttpOnly Cookie 的刷新令牌。
 *
 * <p>刷新令牌之所以要单独走这条通道，是因为它**不允许出现在响应体里**：
 * 一旦进入 JSON，前端就有机会把它写进 localStorage，V2.0 第 4.3 节的
 * 「刷新令牌经 HttpOnly Cookie、不写入 localStorage 长期留存敏感凭证」即被绕过。
 * 因此这里把它与响应体拆开，由 Controller 直接落到 Cookie。</p>
 *
 * @param body         返回给前端的登录/刷新结果（只含访问令牌与用户信息）
 * @param refreshToken 需写入 HttpOnly Cookie 的刷新令牌
 */
public record AuthOutcome(LoginVO body, String refreshToken) {
}
