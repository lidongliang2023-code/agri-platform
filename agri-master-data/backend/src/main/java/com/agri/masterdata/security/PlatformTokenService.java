package com.agri.masterdata.security;

import com.agri.common.security.LoginUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 平台访问令牌的**校验与解析**（只读，不签发、不落库）。
 *
 * <p>与 core-platform 的 {@code JwtAuthFilter} 对齐同一套语义：HS256 验签 +
 * 校验 issuer + 读取 {@code sub / username / roles} 三个声明。差别只在于本类
 * 把结果装进主数据后端既有的 {@link LoginUser}，好让
 * {@code SecurityUtils.getUserId()/getUsername()/getRoles()} 这些既有调用点
 * 一行都不用改 —— 换的是"令牌从哪来"，不是"业务怎么读身份"。</p>
 *
 * <p>与私有 {@code TokenService} 的关键差别：本类**不查 Redis**。平台访问令牌是
 * 无状态 JWT（V2.0 第 5.3 节：网关本地验签、无需每次回源），吊销由 jti 黑名单承担；
 * 而私有 TokenService 要求令牌必须存在于自己的 Redis 里，这正是平台令牌被判
 * "Token无效"(2005) 的原因。</p>
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

    /**
     * 校验并解析平台访问令牌。
     *
     * @param token 不含 "Bearer " 前缀的令牌本体
     * @return 解析成功返回登录用户；签名不符 / issuer 不符 / 已过期 / 声明缺失一律返回 null
     */
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
            loginUser.setToken(token);
            return loginUser;
        } catch (Exception e) {
            // 这里刻意不上抛：调用方需要区分"令牌无效"与"用户未登录"两种业务码，
            // 抛异常会让两者在 GlobalExceptionHandler 里混成同一个响应。
            log.debug("平台令牌校验未通过：{}", e.getMessage());
            return null;
        }
    }

    /** roles 声明可能缺失或不是集合，统一收敛成不可变集合，避免调用方到处判空 */
    private Set<String> toRoleSet(Object raw) {
        if (raw instanceof Collection<?> collection) {
            Set<String> roles = new LinkedHashSet<>();
            for (Object item : collection) {
                if (item != null) {
                    roles.add(String.valueOf(item));
                }
            }
            return roles;
        }
        if (raw instanceof String text && !text.isBlank()) {
            return new LinkedHashSet<>(List.of(text));
        }
        return new LinkedHashSet<>();
    }
}
