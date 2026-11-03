package com.agri.s2b2c.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * S2B2C 认证层：/api/** 必须携带平台访问令牌。
 *
 * <p>RBAC（agri-common）只做"有没有权限码"，不建立"当前是谁"的上下文。
 * 业务侧需要 userId 才能校验 consumerId 归属，所以在这里统一解析一次令牌，
 * 放进 {@link SecurityUtils}，请求结束即清理。</p>
 */
@Component
@RequiredArgsConstructor
public class AuthenticationInterceptor implements HandlerInterceptor {

    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";

    private final PlatformTokenService platformTokenService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (CorsUtils.isPreFlightRequest(request) || !request.getRequestURI().startsWith("/api/")) {
            return true;
        }
        String header = request.getHeader(HEADER);
        if (header == null || !header.startsWith(PREFIX)) {
            return reject(response, "请先登录后访问");
        }
        String token = header.substring(PREFIX.length()).trim();
        LoginUser user = platformTokenService.parse(token);
        if (user == null || user.getUserId() == null) {
            return reject(response, "登录状态已失效，请重新登录");
        }
        SecurityUtils.set(user);
        // 业务侧（能力校验）需要把同一枚令牌转发给核心平台，不能自报身份
        SecurityUtils.setToken(token);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        SecurityUtils.clear();
    }

    private boolean reject(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":401,\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
