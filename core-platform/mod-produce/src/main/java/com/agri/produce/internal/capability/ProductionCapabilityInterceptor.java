package com.agri.produce.internal.capability;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.api.facade.CapabilityCodes;
import com.agri.platform.api.facade.CapabilityFacade;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * 生产管理写接口的能力前置校验。
 *
 * <p>生产数据按主体归属，没加入任何经营主体的账号不应该能写农场/批次/农事数据 ——
 * 以前这些接口只校验令牌，等于"登录了就能写"。这里按 {@code production.manage} 能力拦截，
 * 能力口径与用户中心「已开通能力」一致（见 CapabilityFacade）。</p>
 *
 * <p>只拦写方法；GET 保持开放，否则连看板都打不开。运营端路径在 {@code /api/v1/admin/**} 下，不受影响。</p>
 */
@Component
@RequiredArgsConstructor
public class ProductionCapabilityInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final CapabilityFacade capabilityFacade;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (CorsUtils.isPreFlightRequest(request) || !WRITE_METHODS.contains(request.getMethod())) {
            return true;
        }
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, 401, "请先登录后再维护生产数据");
        }
        Long merchantId;
        try {
            merchantId = Long.valueOf(request.getHeader("X-Merchant-Id"));
            if (merchantId <= 0) throw new NumberFormatException();
        } catch (NumberFormatException e) {
            return reject(response, 403, 403, "请先选择本次业务所属的经营主体");
        }
        CapabilityFacade.Decision decision = capabilityFacade.check(userId, CapabilityCodes.PRODUCTION_MANAGE, merchantId);
        if (decision.granted()) {
            return true;
        }
        return reject(response, HttpServletResponse.SC_FORBIDDEN, 403,
                decision.reason() == null ? "缺少生产管理能力" : decision.reason());
    }

    private boolean reject(HttpServletResponse response, int status, int code, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
