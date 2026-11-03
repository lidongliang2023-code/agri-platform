package com.agri.platform.internal.sso;

import com.agri.platform.internal.merchant.ActiveMerchantService;
import com.agri.core.infra.web.MarketContext;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    /**
     * 会话元数据（UA / IP / 登录时间）。
     *
     * <p>刻意与 {@link #KEY_PREFIX} 的会话值**分开存**：会话值现在是
     * {@code userId:marketId} 这种紧凑格式，{@link #resolve} 靠 {@code split(":")} 解析，
     * 往里加字段就得改热路径。用独立的 hash 存元数据，resolve 一行都不用动。</p>
     */
    private static final String META_PREFIX = "agri:sso:session-meta:";
    /** 「记住我」会话有效期兜底值；实际以 platform_uc_system_config 的 session.remember.days 为准 */
    private static final long REMEMBER_SECONDS_FALLBACK = 7L * 24 * 3600;

    private final StringRedisTemplate redis;
    /** 账号侧策略：记住我天数（运营端可改） */
    private final com.agri.platform.internal.uc.AccountPolicyService accountPolicy;
    private final SsoProperties properties;
    private final ActiveMerchantService activeMerchantService;

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
        return create(userId, marketId, remember, response, null, null);
    }

    /**
     * 建立会话并写 Cookie，同时记录登录设备信息。
     *
     * @param userAgent 浏览器 User-Agent，用于「登录设备」页展示；可为空
     * @param ip        客户端 IP；可为空
     */
    public String create(Long userId, Long marketId, boolean remember, HttpServletResponse response,
                         String userAgent, String ip) {
        String sid = UUID.randomUUID().toString().replace("-", "");
        long seconds = remember ? rememberSeconds() : properties.getSessionTtlHours() * 3600;
        activeMerchantService.ensure(userId, marketId);
        redis.opsForValue().set(KEY_PREFIX + sid, userId + ":" + marketId,
                Duration.ofSeconds(seconds));
        String userIndex = USER_INDEX_PREFIX + userId;
        redis.opsForSet().add(userIndex, sid);
        redis.expire(userIndex, Duration.ofDays(7));
        writeMeta(sid, userAgent, ip, seconds);
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
            // H5 正常走 SSO Cookie；小程序等非 Cookie 客户端使用 Bearer 访问令牌。
            // JwtAuthFilter 会先写入 MarketContext，这里作为同一条分步开通流程的第二凭据通道。
            MarketContext.Session context = MarketContext.get();
            return context == null ? null : new long[]{context.getUserId(), context.getMarketId()};
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
            clearActiveMerchant(value);
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

    /**
     * 写入会话元数据（与主键同寿命）。
     *
     * <p>UA/IP 允许为空：为空时从当前请求上下文兜底取。这样 {@link #create} 的
     * 6 个调用点都不用改签名 —— 少改一处就少一个出错的机会。</p>
     */
    private void writeMeta(String sid, String userAgent, String ip, long seconds) {
        String key = META_PREFIX + sid;
        HttpServletRequest current = currentRequest();
        String ua = userAgent != null ? userAgent
                : (current == null ? null : current.getHeader("User-Agent"));
        String clientIp = ip != null ? ip
                : (current == null ? null : clientIpOf(current));
        Map<String, String> meta = new HashMap<>();
        meta.put("ua", ua == null ? "" : trimTo(ua, 400));
        meta.put("ip", clientIp == null ? "" : trimTo(clientIp, 64));
        meta.put("loginAt", String.valueOf(System.currentTimeMillis()));
        redis.opsForHash().putAll(key, meta);
        redis.expire(key, Duration.ofSeconds(seconds));
    }

    /**
     * 当前账号的全部有效会话（「登录设备」页）。
     *
     * <p><b>不返回原始 sid</b>：sid 就是浏览器里的凭据，泄露出去等于把会话送人。
     * 对外只给 {@code SHA-256(sid)} 的前 12 位作为行标识，吊销时按同样的哈希反查。</p>
     *
     * @param userId    账号 ID
     * @param currentSid 当前请求的 sid，用于标记"本机"；可为空
     * @return 会话列表（按登录时间倒序）
     */
    public List<Map<String, Object>> listSessions(Long userId, String currentSid) {
        Set<String> sids = redis.opsForSet().members(USER_INDEX_PREFIX + userId);
        List<Map<String, Object>> rows = new ArrayList<>();
        if (sids == null || sids.isEmpty()) {
            return rows;
        }
        String currentKey = currentSid == null ? null : sessionKey(currentSid);
        for (String sid : sids) {
            // 索引里可能残留已过期的 sid（Redis 的 set 不会随 key 过期自动清理）
            String value = redis.opsForValue().get(KEY_PREFIX + sid);
            if (value == null) {
                redis.opsForSet().remove(USER_INDEX_PREFIX + userId, sid);
                continue;
            }
            Map<Object, Object> meta = redis.opsForHash().entries(META_PREFIX + sid);
            String ua = String.valueOf(meta.getOrDefault("ua", ""));
            Map<String, Object> row = new LinkedHashMap<>();
            String key = sessionKey(sid);
            row.put("sessionKey", key);
            row.put("device", deviceLabel(ua));
            row.put("userAgent", ua);
            row.put("ip", String.valueOf(meta.getOrDefault("ip", "")));
            row.put("loginAt", parseLong(meta.get("loginAt")));
            row.put("current", key.equals(currentKey));
            rows.add(row);
        }
        rows.sort((a, b) -> Long.compare((Long) b.get("loginAt"), (Long) a.get("loginAt")));
        return rows;
    }

    /**
     * 吊销指定会话。
     *
     * @param userId     账号 ID（用于校验该会话确实属于此人）
     * @param sessionKey 对外暴露的哈希标识
     * @return true 表示已吊销
     */
    public boolean revokeSession(Long userId, String sessionKey) {
        String target = findSidByKey(userId, sessionKey);
        if (target == null) {
            return false;
        }
        String value = redis.opsForValue().get(KEY_PREFIX + target);
        redis.delete(KEY_PREFIX + target);
        redis.delete(META_PREFIX + target);
        removeFromUserIndex(target, value);
        return true;
    }

    /**
     * 吊销除当前会话外的全部会话（"退出其他设备"）。
     *
     * @return 被吊销的数量
     */
    public int revokeOthers(Long userId, String currentSid) {
        Set<String> sids = redis.opsForSet().members(USER_INDEX_PREFIX + userId);
        if (sids == null || sids.isEmpty()) {
            return 0;
        }
        int revoked = 0;
        for (String sid : sids) {
            if (sid.equals(currentSid)) {
                continue;
            }
            String value = redis.opsForValue().get(KEY_PREFIX + sid);
            redis.delete(KEY_PREFIX + sid);
            redis.delete(META_PREFIX + sid);
            removeFromUserIndex(sid, value);
            revoked++;
        }
        return revoked;
    }

    /** 从请求里取当前 sid（供"标记本机"用） */
    public String currentSid(HttpServletRequest request) {
        return readSid(request);
    }

    private String findSidByKey(Long userId, String sessionKey) {
        Set<String> sids = redis.opsForSet().members(USER_INDEX_PREFIX + userId);
        if (sids == null) {
            return null;
        }
        for (String sid : sids) {
            if (sessionKey(sid).equals(sessionKey)) {
                return sid;
            }
        }
        return null;
    }

    /** sid → 对外标识（SHA-256 前 12 位） */
    private static String sessionKey(String sid) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(sid.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                sb.append(String.format("%02x", digest[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 一定存在；退化成截断，仍然不泄露完整 sid
            return sid.length() <= 12 ? sid : sid.substring(0, 12);
        }
    }

    /**
     * User-Agent → 可读设备名。
     *
     * <p>服务端统一解析，避免各端各写一套正则；认不出就返回「未知设备」，
     * 不猜一个看起来很像的品牌。</p>
     */
    private static String deviceLabel(String ua) {
        if (ua == null || ua.isBlank()) {
            return "未知设备";
        }
        String s = ua.toLowerCase();
        String os;
        if (s.contains("windows")) os = "Windows";
        else if (s.contains("iphone") || s.contains("ipad") || s.contains("ios")) os = "iOS";
        else if (s.contains("android")) os = "Android";
        else if (s.contains("mac os") || s.contains("macintosh")) os = "macOS";
        else if (s.contains("linux")) os = "Linux";
        else os = "未知系统";

        String browser;
        if (s.contains("edg/")) browser = "Edge";
        else if (s.contains("chrome/")) browser = "Chrome";
        else if (s.contains("firefox/")) browser = "Firefox";
        else if (s.contains("safari/")) browser = "Safari";
        else if (s.contains("micromessenger")) browser = "微信";
        else browser = "未知浏览器";
        return os + " · " + browser;
    }

    private static long parseLong(Object value) {
        if (value == null) {
            return 0L;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static String trimTo(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private void removeFromUserIndex(String sid, String sessionValue) {
        if (sessionValue == null || !sessionValue.contains(":")) {
            return;
        }
        String userId = sessionValue.substring(0, sessionValue.indexOf(':'));
        redis.opsForSet().remove(USER_INDEX_PREFIX + userId, sid);
    }

    private void clearActiveMerchant(String sessionValue) {
        if (sessionValue == null || !sessionValue.contains(":")) {
            return;
        }
        String[] parts = sessionValue.split(":");
        if (parts.length < 2) {
            return;
        }
        try {
            activeMerchantService.clear(Long.valueOf(parts[0]), Long.valueOf(parts[1]));
        } catch (NumberFormatException ignored) {
            // 会话值异常由登录流程重新建立，不在退出时扩大故障面。
        }
    }

    /** 取当前线程绑定的请求（无 Web 上下文时返回 null） */
    private HttpServletRequest currentRequest() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        return attributes instanceof ServletRequestAttributes servlet
                ? servlet.getRequest() : null;
    }

    /** 取真实客户端 IP：优先 X-Forwarded-For 第一段（本机在 nginx 后面） */
    private static String clientIpOf(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
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
    /** 记住我天数：跟随运营端配置，读不到就用 7 天兜底。 */
    private long rememberSeconds() {
        try {
            return accountPolicy.rememberDays() * 24L * 3600;
        } catch (RuntimeException e) {
            return REMEMBER_SECONDS_FALLBACK;
        }
    }

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
