package com.agri.s2b2c.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 平台访问令牌的校验与解析（只读）。
 *
 * <p>与 core-platform 的 JwtAuthFilter 同一套语义：HS256 验签 + 校验 issuer，
 * 读 {@code sub / username / roles}。刻意不查 Redis：平台令牌是无状态 JWT，
 * 吊销由 jti 黑名单承担。</p>
 */
@Slf4j
@Service
public class PlatformTokenService {

    private final PlatformJwtProperties properties;
    private final SecretKey secretKey;

    public PlatformTokenService(PlatformJwtProperties properties) {
        this.properties = properties;
        this.secretKey = Keys.hmacShaKeyFor(properties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public LoginUser parse(String token) {
        if (token == null || token.isEmpty()) {
            return null;
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .requireIssuer(properties.getIssuer())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            LoginUser loginUser = new LoginUser();
            loginUser.setUserId(Long.valueOf(claims.getSubject()));
            loginUser.setUsername(claims.get("username", String.class));
            loginUser.setRoles(toRoleSet(claims.get("roles")));
            return loginUser;
        } catch (RuntimeException e) {
            log.debug("平台令牌解析失败：{}", e.getMessage());
            return null;
        }
    }

    private Set<String> toRoleSet(Object raw) {
        Set<String> roles = new LinkedHashSet<>();
        if (raw instanceof Collection<?> collection) {
            for (Object item : collection) {
                if (item != null) {
                    roles.add(String.valueOf(item));
                }
            }
        }
        return roles;
    }
}
