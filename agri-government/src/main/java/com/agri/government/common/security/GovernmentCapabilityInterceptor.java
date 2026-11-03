package com.agri.government.common.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * 移动执法端（政府人员）写操作要求 gov.oversight 能力。
 *
 * <p>监管对象端（/api/v1/government/** 非 mobile）仍按 RBAC 的 gov:citizen 准入 ——
 * 那是企业查看监管结果，不是政府人员操作。执法端的上报/处置才需要政府身份。</p>
 */
@Component
@RequiredArgsConstructor
public class GovernmentCapabilityInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final CapabilityGuard capabilityGuard;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (CorsUtils.isPreFlightRequest(request) || !WRITE_METHODS.contains(request.getMethod())) {
            return true;
        }
        try {
            capabilityGuard.require(request.getHeader("Authorization"), "gov.oversight", "提交执法数据");
            return true;
        } catch (org.springframework.web.server.ResponseStatusException e) {
            // 拦截器里抛出的异常不会走 @ControllerAdvice，必须自己写响应，否则变成 500
            response.setStatus(e.getStatusCode().value());
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"code\":" + e.getStatusCode().value()
                    + ",\"message\":\"" + (e.getReason() == null ? "无权限" : e.getReason())
                    + "\",\"data\":null}");
            return false;
        }
    }
}
