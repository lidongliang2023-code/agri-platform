package com.agri.common.security;

import com.agri.common.constant.GlobalConstants;
import com.agri.common.constant.RedisKeys;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class TokenService {

    private final StringRedisTemplate redisTemplate;
    private final SecretKey secretKey;

    public TokenService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.secretKey = Keys.hmacShaKeyFor(GlobalConstants.JWT_SECRET.getBytes(StandardCharsets.UTF_8));
    }

    public String createToken(LoginUser loginUser) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", loginUser.getUserId());
        claims.put("username", loginUser.getUsername());
        claims.put("tenantId", loginUser.getTenantId());
        claims.put("roles", loginUser.getRoles());
        claims.put("permissions", loginUser.getPermissions());

        String token = Jwts.builder()
                .claims(claims)
                .subject(loginUser.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + GlobalConstants.JWT_EXPIRATION))
                .signWith(secretKey)
                .compact();

        String tokenKey = RedisKeys.getTokenKey(token);
        redisTemplate.opsForValue().set(tokenKey, String.valueOf(loginUser.getUserId()),
                GlobalConstants.JWT_EXPIRATION, TimeUnit.MILLISECONDS);

        loginUser.setToken(token);
        return token;
    }

    public LoginUser parseToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            LoginUser loginUser = new LoginUser();
            loginUser.setUserId(Long.valueOf(claims.get("userId").toString()));
            loginUser.setUsername(claims.getSubject());
            loginUser.setTenantId(claims.get("tenantId") != null ? claims.get("tenantId").toString() : null);
            loginUser.setToken(token);

            return loginUser;
        } catch (ExpiredJwtException e) {
            log.warn("Token expired: {}", e.getMessage());
            return null;
        } catch (JwtException e) {
            log.warn("Invalid token: {}", e.getMessage());
            return null;
        }
    }

    public boolean validateToken(String token) {
        try {
            String tokenKey = RedisKeys.getTokenKey(token);
            Boolean hasKey = redisTemplate.hasKey(tokenKey);
            if (Boolean.FALSE.equals(hasKey)) {
                return false;
            }

            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            log.warn("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    public void removeToken(String token) {
        String tokenKey = RedisKeys.getTokenKey(token);
        redisTemplate.delete(tokenKey);
    }

    public void refreshToken(LoginUser loginUser) {
        String tokenKey = RedisKeys.getTokenKey(loginUser.getToken());
        redisTemplate.expire(tokenKey, GlobalConstants.JWT_EXPIRATION, TimeUnit.MILLISECONDS);
    }
}
