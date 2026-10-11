package com.agri.core.infra.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * JWT 工具：签发/校验短时效访问令牌。
 *
 * <p>每枚访问令牌都带 {@code jti}（V2.0 第 5.3 节 Claims 表：「jti 令牌唯一 ID，用于吊销追踪」）。
 * jti 是实现"登出 / 改密 / 管理员强制下线后，已签发的令牌立刻失效"的唯一抓手 ——
 * 无状态 JWT 一旦签出去就收不回来，只能按 jti 拦黑名单。</p>
 */
@Component
@RequiredArgsConstructor
public class JwtUtil {

    private final JwtProperties properties;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(properties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    /** 签发结果：令牌本体 + 吊销所需的 jti 与过期时间 */
    public record IssuedAccessToken(String token, String jti, long expiresAtMillis) {
    }

    /**
     * 签发访问令牌。
     *
     * @return 令牌本体、jti 与过期时间；调用方须把 jti 登记进吊销索引，
     *         否则该令牌在"全端登出"时无法被精确吊销
     */
    public IssuedAccessToken issueAccessToken(Long userId, String username, Long marketId, List<String> roles) {
        long ttlMillis = properties.getAccessTtlMinutes() * 60_000;
        long expiresAtMillis = System.currentTimeMillis() + ttlMillis;
        String jti = UUID.randomUUID().toString();
        String token = Jwts.builder()
                .issuer(properties.getIssuer())
                .subject(String.valueOf(userId))
                .id(jti)
                .claim("username", username)
                .claim("marketId", marketId)
                .claim("roles", roles)
                .issuedAt(new Date())
                .expiration(new Date(expiresAtMillis))
                .signWith(key(), Jwts.SIG.HS256)
                .compact();
        return new IssuedAccessToken(token, jti, expiresAtMillis);
    }

    /** 兼容旧签名：只要令牌本体、不需要登记吊销索引时使用（如测试与内部调用） */
    public String createAccessToken(Long userId, String username, Long marketId, List<String> roles) {
        return issueAccessToken(userId, username, marketId, roles).token();
    }

    /** 校验失败抛 io.jsonwebtoken.JwtException（含过期） */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key())
                .requireIssuer(properties.getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long accessTtlSeconds() {
        return properties.getAccessTtlMinutes() * 60;
    }
}
