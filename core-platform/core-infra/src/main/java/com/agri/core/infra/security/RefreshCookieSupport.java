package com.agri.core.infra.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 刷新令牌的 HttpOnly Cookie 载体（V2.0 第 4.3 节「Token 存储」）。
 *
 * <p>规范要求：<b>访问令牌</b>交由前端存内存（或短时 sessionStorage），
 * <b>刷新令牌</b>必须经 HttpOnly Cookie 下发，不进 localStorage、不进响应体。
 * 本类负责"下发 / 读取 / 清除"这一层，令牌本身仍由 {@link TokenService} 在 Redis 侧
 * 一次性旋转与吊销。</p>
 *
 * <p><b>为什么手写 Set-Cookie 字符串而不是 {@code response.addCookie(Cookie)}：</b>
 * Servlet 的 {@link Cookie} API 没有 SameSite 属性（Servlet 6 仍未提供），
 * 用它拼出来的 Cookie 缺 SameSite，等于放弃 CSRF 的第一道防线。</p>
 *
 * <p><b>默认 Path 收窄到认证前缀</b>（{@code /api/v1/auth}）：刷新令牌只在换发/登出时用得到，
 * 业务接口带着它跑没有意义，收窄后即使业务请求被中间层记录也不会捎带刷新令牌。</p>
 */
@Component
@RequiredArgsConstructor
public class RefreshCookieSupport {

    private final JwtProperties properties;

    @Value("${agri.auth.refresh-cookie.name:agri_refresh_token}")
    private String cookieName;

    @Value("${agri.auth.refresh-cookie.path:/api/v1/auth}")
    private String cookiePath;

    /** 生产（HTTPS）必须置 true；本地 http 调试置 true 会被浏览器丢弃，故默认 false。 */
    @Value("${agri.auth.refresh-cookie.secure:false}")
    private boolean secure;

    /** 同域部署用 Lax；前后端分属不同站点时需改为 None（届时必须同时启用 Secure）。 */
    @Value("${agri.auth.refresh-cookie.same-site:Lax}")
    private String sameSite;

    /** 下发刷新令牌 Cookie（有效期与 Redis 侧刷新令牌 TTL 一致）。 */
    public void write(HttpServletResponse response, String refreshToken) {
        long maxAgeSeconds = (long) properties.getRefreshTtlDays() * 24 * 60 * 60;
        response.addHeader("Set-Cookie", build(refreshToken, maxAgeSeconds));
    }

    /** 清除刷新令牌 Cookie（登出时调用，Max-Age=0 立即失效）。 */
    public void clear(HttpServletResponse response) {
        response.addHeader("Set-Cookie", build("", 0L));
    }

    /** 读取刷新令牌；不存在时返回 null，由调用方决定是回退到请求体还是判为未认证。 */
    public String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value == null || value.isBlank()) ? null : value;
            }
        }
        return null;
    }

    private String build(String value, long maxAgeSeconds) {
        String safeValue = value == null ? "" : value;
        StringBuilder header = new StringBuilder()
                .append(cookieName).append('=').append(safeValue)
                .append("; Path=").append(cookiePath)
                .append("; Max-Age=").append(maxAgeSeconds)
                .append("; HttpOnly")
                .append("; SameSite=").append(sameSite);
        if (secure) {
            header.append("; Secure");
        }
        return header.toString();
    }
}
