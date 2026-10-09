package com.agri.core.infra.security;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

/**
 * 服务端刷新令牌（存 Redis，一次性使用、可吊销）——令牌绝不入 localStorage / URL（认证安全规范）。
 */
@Component
@RequiredArgsConstructor
public class TokenService {

    private static final String KEY_PREFIX = "agri:refresh:";

    private final StringRedisTemplate redis;
    private final JwtProperties properties;

    public String issueRefreshToken(Long userId, Long marketId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        redis.opsForValue().set(KEY_PREFIX + token, userId + ":" + marketId,
                Duration.ofDays(properties.getRefreshTtlDays()));
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
        return new long[]{Long.parseLong(parts[0]), Long.parseLong(parts[1])};
    }

    public void revoke(String refreshToken) {
        redis.delete(KEY_PREFIX + refreshToken);
    }
}
