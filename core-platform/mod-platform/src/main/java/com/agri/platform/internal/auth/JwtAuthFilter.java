package com.agri.platform.internal.auth;

import com.agri.core.infra.security.JwtUtil;
import com.agri.core.infra.security.TokenRevocationService;
import com.agri.core.infra.util.JsonUtil;
import com.agri.core.infra.web.MarketContext;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * JWT 认证过滤器：解析访问令牌 → 写入市场上下文（ADR-005 框架层统一注入）。
 * 白名单之外一律要求 Bearer Token；失败返回 401 规范化 JSON。
 */
@Component
@Order(2)
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final List<String> WHITELIST = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            // 登出：凭刷新令牌（HttpOnly Cookie）即可执行，必须放行 ——
            // 访问令牌过期后用户仍需要能退出，否则登出会因 401 永远失败（这正是修复前的表现）。
            "/api/v1/auth/logout",
            // SSO 授权码流程（V2.0 5.2）：这四个端点本身就在"拿令牌之前"，
            // 要求它们带访问令牌等于让登录流程无法开始（鸡生蛋问题）。
            "/api/v1/sso/authorize",
            "/api/v1/sso/login",
            "/api/v1/sso/token",
            "/api/v1/sso/logout",
            // 公开行情（数据分级 L1）——卫星服务 satellite-quote-push 拉取数据源亦复用此口径
            "/api/v1/quotes/**",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/actuator/**",
            // 内部事件入口：以 X-Internal-Token 校验（见 InternalEventIngressController）
            "/internal/**",
            "/error");

    private final JwtUtil jwtUtil;
    private final TokenRevocationService revocationService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // CORS 预检（OPTIONS）不携带 Authorization，浏览器也不会为预检附加自定义头。
        // 若在此拦截，预检会在到达 CORS 校验之前就被 401，浏览器直接判定跨域失败，
        // 表现为"接口存在但前端永远调不通"。预检是否放行由 CORS 配置
        // （WebConfig#corsConfigurer）裁决：通过则返回 200 + Access-Control-* 头，
        // 来源不在白名单则返回 403 Invalid CORS request，两种情况都不会进入控制器。
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return WHITELIST.stream().anyMatch(p -> MATCHER.match(p, request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = bearerToken(request);
        if (token == null) {
            unauthorized(response, "缺少访问令牌");
            return;
        }
        try {
            Claims claims = jwtUtil.parse(token);
            // 黑名单检查必须排在业务之前：已吊销的令牌即便签名有效、也未过期，也必须拒绝。
            // 这是"登出 / 改密 / 强制下线立即生效"的唯一落点（V2.0 5.3 吊销、5.4 单点登出）。
            if (revocationService.isRevoked(claims.getId())) {
                unauthorized(response, "令牌已吊销，请重新登录");
                return;
            }
            Long userId = Long.valueOf(claims.getSubject());
            Number marketId = (Number) claims.get("marketId");
            List<String> roles = ((List<?>) claims.get("roles")).stream().map(String::valueOf).toList();
            MarketContext.set(new MarketContext.Session(userId, claims.get("username", String.class),
                    marketId == null ? 1L : marketId.longValue(), roles));
        } catch (Exception e) {
            unauthorized(response, "令牌无效或已过期");
            return;
        }
        try {
            chain.doFilter(request, response);
        } finally {
            MarketContext.clear();
        }
    }

    private String bearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(401);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(JsonUtil.MAPPER.writeValueAsString(ApiResponse.fail(ErrorCode.UNAUTHORIZED)));
    }
}
