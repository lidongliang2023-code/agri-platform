package com.agri.platform.internal.sso;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

// SSO 全局会话（V2.0 第 5.1 节：「浏览器侧 SSO 域 HttpOnly 会话 Cookie + 服务端会话」）。
//
// 它是"跨子系统免登"的载体：用户只要在 sso 域登录过一次，之后再访问任何子系统，
// authorize 端点凭这个会话直接发码，不再要求输密码。
// 会话真身在 Redis，浏览器只拿一个不可猜测的 sid（HttpOnly），登出即销毁。
@Component
@RequiredArgsConstructor
public class SsoSessionService {

    private static final String KEY_PREFIX = "agri:sso:session:";

    private final StringRedisTemplate redis;
    private final SsoProperties properties;

    /**
     * 建立会话并写 Cookie。
     *
     * @return 会话 ID（同时是浏览器侧 Cookie 的值）
     */
    public String create(Long userId, Long marketId, HttpServletResponse response) {
        String sid = UUID.randomUUID().toString().replace("-", "");
        redis.opsForValue().set(KEY_PREFIX + sid, userId + ":" + marketId,
                Duration.ofHours(properties.getSessionTtlHours()));
        response.addHeader("Set-Cookie", cookie(sid, properties.getSessionTtlHours() * 3600));
        return sid;
    }

    /**
     * 解析会话。
     *
     * @return [userId, marketId]；无 Cookie、会话不存在或已过期时返回 null
     */
    public long[] resolve(HttpServletRequest request) {
        String sid = readSid(request);
        if (sid == null) {
            return null;
        }
        String value = redis.opsForValue().get(KEY_PREFIX + sid);
        if (value == null) {
            return null;
        }
        String[] parts = value.split(":");
        return new long[]{Long.parseLong(parts[0]), Long.parseLong(parts[1])};
    }

    /** 销毁会话并清 Cookie（单点登出；V2.0 第 5.4 节第 2 步） */
    public void destroy(HttpServletRequest request, HttpServletResponse response) {
        String sid = readSid(request);
        if (sid != null) {
            redis.delete(KEY_PREFIX + sid);
        }
        response.addHeader("Set-Cookie", cookie("", 0L));
    }

    private String readSid(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (properties.getSessionCookieName().equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value == null || value.isBlank()) ? null : value;
            }
        }
        return null;
    }

    // 手写 Set-Cookie：Servlet 的 Cookie API 没有 SameSite 属性（与 RefreshCookieSupport 同一原因）
    private String cookie(String value, long maxAgeSeconds) {
        StringBuilder header = new StringBuilder()
                .append(properties.getSessionCookieName()).append('=').append(value == null ? "" : value)
                .append("; Path=").append(properties.getSessionCookiePath())
                .append("; Max-Age=").append(maxAgeSeconds)
                .append("; HttpOnly")
                .append("; SameSite=").append(properties.getSessionCookieSameSite());
        if (properties.isSessionCookieSecure()) {
            header.append("; Secure");
        }
        return header.toString();
    }
}
