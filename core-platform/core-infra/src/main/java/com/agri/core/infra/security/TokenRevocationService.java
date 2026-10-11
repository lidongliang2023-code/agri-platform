package com.agri.core.infra.security;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;

/**
 * 访问令牌吊销（V2.0 第 5.3 节「吊销」、第 5.4 节「单点登出」，均要求 jti 黑名单）。
 *
 * <p>两件事：</p>
 * <ol>
 *   <li><b>黑名单</b>：按 jti 拉黑，TTL 等于该令牌的剩余有效期 —— 令牌本来就要过期，
 *       过期后黑名单条目也没有意义，不设 TTLL 会让 Redis 无限膨胀。</li>
 *   <li><b>签发索引</b>：按用户记录已签发且未过期的 jti（zset，score=过期时间戳）。
 *       没有它就没法回答"这个用户现在手上还有哪些有效令牌"，
 *       也就无法实现 V2.0 第 5.4 节要求的"登出时吊销该用户所有子系统的令牌"。</li>
 * </ol>
 *
 * <p><b>与"网关本地验签"的关系</b>：V2.0 要求网关本地验签、不必每次回源，但黑名单必须实时查
 * （否则吊销要等令牌自然过期才生效）。折中是：验签仍在本地做，黑名单只查一次 Redis 键存在性 ——
 * 代价是每个鉴权请求多一次 Redis 往返，收益是登出立即全局生效。</p>
 *
 * <p><b>部署位置</b>：目前 Redis 属于 core-platform。SSO 中心拆出去之后，黑名单应搬到 SSO 中心
 * 或独立共享实例，由各子系统网关读取；本类的方法签名即按那个形态设计。</p>
 */
@Component
@RequiredArgsConstructor
public class TokenRevocationService {

    /** 已吊销令牌：存在即为已吊销 */
    private static final String BLACKLIST_PREFIX = "agri:jwt:blacklist:";
    /** 某用户已签发未过期的 jti 集合（score = 过期时间戳毫秒） */
    private static final String ISSUED_PREFIX = "agri:jwt:issued:";

    private final StringRedisTemplate redis;

    /**
     * 登记一枚刚签发的访问令牌。
     *
     * @param jti             令牌唯一 ID
     * @param userId          归属用户
     * @param expiresAtMillis 过期时间戳（毫秒）
     */
    public void recordIssued(String jti, Long userId, long expiresAtMillis) {
        String key = ISSUED_PREFIX + userId;
        redis.opsForZSet().add(key, jti, expiresAtMillis);
        long ttlMillis = Math.max(expiresAtMillis - System.currentTimeMillis(), 0L) + 60_000L;
        redis.expire(key, Duration.ofMillis(ttlMillis));
    }

    /**
     * 吊销单枚令牌（改密、管理员强制下线某会话时用）。
     *
     * @param jti             令牌唯一 ID
     * @param expiresAtMillis 过期时间戳；已过期则无需拉黑，直接跳过
     */
    public void revoke(String jti, long expiresAtMillis) {
        long ttlMillis = expiresAtMillis - System.currentTimeMillis();
        if (ttlMillis <= 0) {
            return;
        }
        redis.opsForValue().set(BLACKLIST_PREFIX + jti, "1", Duration.ofMillis(ttlMillis));
    }

    /**
     * 该令牌是否已被吊销。
     *
     * @param jti 令牌唯一 ID；为空视为未吊销（兼容无 jti 的历史令牌）
     * @return 已吊销返回 true
     */
    public boolean isRevoked(String jti) {
        if (jti == null || jti.isBlank()) {
            return false;
        }
        return Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + jti));
    }

    /**
     * 吊销某用户当前所有未过期的访问令牌 —— "一处登出、全部失效"的落点。
     *
     * @param userId 用户 ID
     * @return 实际拉黑的令牌数
     */
    public int revokeAllForUser(Long userId) {
        String key = ISSUED_PREFIX + userId;
        Set<String> jtis = redis.opsForZSet().range(key, 0, -1);
        long now = System.currentTimeMillis();
        int revoked = 0;
        if (jtis != null) {
            for (String jti : jtis) {
                Double expiresAt = redis.opsForZSet().score(key, jti);
                if (expiresAt == null || expiresAt.longValue() <= now) {
                    continue;
                }
                revoke(jti, expiresAt.longValue());
                revoked++;
            }
        }
        redis.delete(key);
        return revoked;
    }
}
