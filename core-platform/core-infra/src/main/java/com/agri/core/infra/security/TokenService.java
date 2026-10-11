package com.agri.core.infra.security;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * 服务端刷新令牌（存 Redis，一次性使用、可吊销）——令牌绝不入 localStorage / URL（认证安全规范）。
 *
 * <p>除按令牌本身的键（{@code agri:refresh:<token>}）外，另维护一份**按用户**的索引
 * （{@code agri:refresh:user:<userId>}）。索引是为 V2.0 第 5.4 节「单点登出」准备的：
 * 登出要吊销的是"该用户的**所有**刷新令牌"，而登出请求只带来其中一枚，
 * 没有索引就只能吊销手里这一枚，其它端的会话仍然活着。</p>
 */
@Component
@RequiredArgsConstructor
public class TokenService {

    private static final String KEY_PREFIX = "agri:refresh:";
    /** 某用户当前全部刷新令牌的索引（集合） */
    private static final String USER_INDEX_PREFIX = "agri:refresh:user:";

    private final StringRedisTemplate redis;
    private final JwtProperties properties;

    public String issueRefreshToken(Long userId, Long marketId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        redis.opsForValue().set(KEY_PREFIX + token, userId + ":" + marketId,
                Duration.ofDays(properties.getRefreshTtlDays()));
        String indexKey = USER_INDEX_PREFIX + userId;
        redis.opsForSet().add(indexKey, token);
        redis.expire(indexKey, Duration.ofDays(properties.getRefreshTtlDays()));
        return token;
    }

    /** 校验并销毁（旋转） */
    public long[] consume(String refreshToken) {
        String value = redis.opsForValue().get(KEY_PREFIX + refreshToken);
        if (value == null) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        redis.delete(KEY_PREFIX + refreshToken);
        String[] parts = value.split(":");
        redis.opsForSet().remove(USER_INDEX_PREFIX + parts[0], refreshToken);
        return new long[]{Long.parseLong(parts[0]), Long.parseLong(parts[1])};
    }

    /**
     * 吊销单枚刷新令牌，并返回它归属的用户 ID。
     *
     * @param refreshToken 刷新令牌；不存在或已失效时返回 null
     * @return 归属用户 ID，取不到时为 null（调用方据此决定能否继续做"全端吊销"）
     */
    public Long revoke(String refreshToken) {
        String value = redis.opsForValue().get(KEY_PREFIX + refreshToken);
        if (!Boolean.TRUE.equals(redis.delete(KEY_PREFIX + refreshToken))) {
            return null;
        }
        if (value == null) {
            return null;
        }
        String userId = value.split(":")[0];
        redis.opsForSet().remove(USER_INDEX_PREFIX + userId, refreshToken);
        return Long.parseLong(userId);
    }

    /**
     * 吊销某用户的全部刷新令牌 —— "一处登出、全网下线"的刷新令牌侧。
     *
     * @param userId 用户 ID
     * @return 实际吊销的令牌数
     */
    public int revokeAllForUser(Long userId) {
        String indexKey = USER_INDEX_PREFIX + userId;
        Set<String> tokens = redis.opsForSet().members(indexKey);
        int revoked = 0;
        if (tokens != null) {
            for (String token : tokens) {
                if (Boolean.TRUE.equals(redis.delete(KEY_PREFIX + token))) {
                    revoked++;
                }
            }
        }
        redis.delete(indexKey);
        return revoked;
    }
}
