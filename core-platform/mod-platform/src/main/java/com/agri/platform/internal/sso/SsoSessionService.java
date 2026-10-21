package com.agri.platform.internal.sso;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;
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
    private static final String USER_INDEX_PREFIX = "agri:sso:user-sessions:";
    /** 「7 天内自动登录」勾选后的会话有效期 */
    private static final long REMEMBER_SECONDS = 7L * 24 * 3600;

    private final StringRedisTemplate redis;
    private final SsoProperties properties;

    /**
     * 建立会话并写 Cookie。
     *
     * @return 会话 ID（同时是浏览器侧 Cookie 的值）
     */
    public String create(Long userId, Long marketId, HttpServletResponse response) {
        return create(userId, marketId, false, response);
    }

    /**
     * 建立会话并写 Cookie。
     *
     * @param remember 勾选「7 天内自动登录」时为 true：会话与 Cookie 都用 7 天；
     *                 否则沿用配置的默认时长（本机 8 小时）
     */
    public String create(Long userId, Long marketId, boolean remember, HttpServletResponse response) {
        String sid = UUID.randomUUID().toString().replace("-", "");
        long seconds = remember ? REMEMBER_SECONDS : properties.getSessionTtlHours() * 3600;
        redis.opsForValue().set(KEY_PREFIX + sid, userId + ":" + marketId,
                Duration.ofSeconds(seconds));
        String userIndex = USER_INDEX_PREFIX + userId;
        redis.opsForSet().add(userIndex, sid);
        redis.expire(userIndex, Duration.ofDays(7));
        response.addHeader("Set-Cookie", cookie(sid, seconds));
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
            String value = redis.opsForValue().get(KEY_PREFIX + sid);
            redis.delete(KEY_PREFIX + sid);
            removeFromUserIndex(sid, value);
        }
        response.addHeader("Set-Cookie", cookie("", 0L));
    }

    /**
     * 吊销某用户全部 SSO 浏览器会话。
     *
     * <p>密码重置后使用：仅吊销访问令牌还不够，旧 SSO Cookie 仍可通过授权端点换到新令牌。</p>
     */
    public int revokeAllForUser(Long userId) {
        String userIndex = USER_INDEX_PREFIX + userId;
        Set<String> sessions = redis.opsForSet().members(userIndex);
        int revoked = 0;
        if (sessions != null) {
            for (String sid : sessions) {
                if (Boolean.TRUE.equals(redis.delete(KEY_PREFIX + sid))) {
                    revoked++;
                }
            }
        }
        redis.delete(userIndex);
        return revoked;
    }

    private void removeFromUserIndex(String sid, String sessionValue) {
        if (sessionValue == null || !sessionValue.contains(":")) {
            return;
        }
        String userId = sessionValue.substring(0, sessionValue.indexOf(':'));
        redis.opsForSet().remove(USER_INDEX_PREFIX + userId, sid);
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
