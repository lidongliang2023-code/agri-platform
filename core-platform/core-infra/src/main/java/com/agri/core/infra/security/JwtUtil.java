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

/**
 * JWT 工具：签发/校验短时效访问令牌。
 */
@Component
@RequiredArgsConstructor
public class JwtUtil {

    private final JwtProperties properties;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(properties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(Long userId, String username, Long marketId, List<String> roles) {
        long ttlMillis = properties.getAccessTtlMinutes() * 60_000;
        return Jwts.builder()
                .issuer(properties.getIssuer())
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("marketId", marketId)
                .claim("roles", roles)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMillis))
                .signWith(key(), Jwts.SIG.HS256)
                .compact();
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
