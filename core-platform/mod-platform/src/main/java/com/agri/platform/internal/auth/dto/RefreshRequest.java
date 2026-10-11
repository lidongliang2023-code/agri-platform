package com.agri.platform.internal.auth.dto;

/**
 * 刷新 / 登出请求体。
 *
 * <p>刷新令牌现在以 HttpOnly Cookie 为主通道（见 {@code RefreshCookieSupport}）；
 * 本请求体保留为**迁移窗口的过渡入口**，供尚未升级的客户端继续提交令牌，
 * 因此不再强制非空 —— 若两条通道都没有令牌，由 Controller 判为未认证。
 * 待所有客户端切换完毕后可整体删除本 DTO。</p>
 */
public record RefreshRequest(String refreshToken) {
}
