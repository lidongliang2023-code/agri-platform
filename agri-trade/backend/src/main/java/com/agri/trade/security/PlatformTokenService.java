package com.agri.trade.security;

import com.agri.trade.common.security.LoginUser;
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
 * 平台访问令牌的**校验与解析**（只读，不签发、不落库）。
 *
 * <p>与 core-platform 的 {@code JwtAuthFilter} 对齐同一套语义：HS256 验签 + 校验 issuer +
 * 读 {@code sub / username / roles} 三个声明，把结果装进 {@link LoginUser}，
 * 好让业务侧统一用 {@code SecurityUtils.getUserId()/getUsername()} 读身份。</p>
 *
 * <p>刻意**不查 Redis**：平台访问令牌是无状态 JWT（V2.0 第 5.3 节"网关本地验签、
 * 无需每次回源"），吊销由 jti 黑名单承担。主数据模块踩过的坑是"拿私有会话令牌的
 * 校验方式去验平台令牌"，结果 SSO 令牌被判 2005 Token无效。</p>
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
            // 不上抛：调用方要能区分"令牌无效"与"没带令牌"两种情形，
            // 抛异常只会让它们在统一异常处理里混成同一个响应。
            log.debug("平台令牌校验未通过：{}", e.getMessage());
            return null;
        }
    }

    private static Set<String> toRoleSet(Object roles) {
        Set<String> result = new LinkedHashSet<>();
        if (roles instanceof Collection<?> collection) {
            for (Object role : collection) {
                if (role != null) {
                    result.add(String.valueOf(role));
                }
            }
        }
        return result;
    }
}
