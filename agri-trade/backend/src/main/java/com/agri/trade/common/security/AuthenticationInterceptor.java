package com.agri.trade.common.security;

import com.agri.trade.security.PlatformTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 认证拦截器 —— 一次请求只在这里判定身份。
 *
 * <p>令牌只有一个来源：**平台访问令牌**（SSO 登录后拿到的那种，无状态 JWT）。
 * 交易模块此前没有任何认证，这是按架构文档 V2.0「九个前台统一接 SSO」补齐的第一层。</p>
 *
 * <p>为什么直接写响应、不抛异常：交易模块没有全局异常处理器，
 * 抛出去会变成 500（"服务器错误"），而这里要表达的是 401（"你没登录"）——
 * 前端据此决定是弹登录还是提示无权限，两者不能混。</p>
 */
@Slf4j
@Component
public class AuthenticationInterceptor implements HandlerInterceptor {

    /**
     * 运营端角色。
     *
     * <p>取自平台角色表：SUPER_ADMIN（超级管理员）与 MARKET_OPS（市场运营，
     * 权限含 trade:read / trade:write）。</p>
     */
    private static final java.util.Set<String> OPERATOR_ROLES =
            java.util.Set.of("SUPER_ADMIN", "MARKET_OPS");

    /** 运营端接口前缀。 */
    private static final String OPERATOR_PATH_PREFIX = "/api/trade/admin/";

    private final PlatformTokenService platformTokenService;

    public AuthenticationInterceptor(PlatformTokenService platformTokenService) {
        this.platformTokenService = platformTokenService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 静态资源、错误页这些不是 HandlerMethod，直接放过
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        String token = SecurityUtils.getToken();
        if (token == null || token.isEmpty()) {
            return reject(response, 401, "未登录：缺少访问令牌");
        }

        LoginUser loginUser = platformTokenService.parse(token);
        if (loginUser == null) {
            return reject(response, 401, "令牌无效或已过期");
        }

        // 运营端接口要角色，不只是"登录了"。
        //
        // 补这道判断之前，运营端整片接口（订单监管/纠纷仲裁/退款审核/赔付执行/货源审核/交易大盘）
        // **只校验了令牌有效**：任何一个普通用户（例如只有 FARMER 角色的农场账号）拿到自己的令牌
        // 就能看到全平台订单、审批别人的退款与赔付。LoginUser.hasRole / SecurityUtils.hasRole
        // 早就写好了，但从来没有任何地方调用过 —— 权限体系是"建了没用"。
        if (request.getRequestURI().startsWith(OPERATOR_PATH_PREFIX)
                && loginUser.getRoles().stream().noneMatch(OPERATOR_ROLES::contains)) {
            log.warn("非运营角色访问运营端接口被拒：user={} roles={} uri={}",
                    loginUser.getUsername(), loginUser.getRoles(), request.getRequestURI());
            return reject(response, 403, "无权访问运营端接口：需要运营角色（SUPER_ADMIN 或 MARKET_OPS）");
        }

        LoginUserHolder.setLoginUser(loginUser);
        log.debug("已认证：{}", loginUser.getUsername());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        LoginUserHolder.removeLoginUser();
    }

    private boolean reject(HttpServletResponse response, int code, String message) throws Exception {
        response.setStatus(code == 403 ? HttpServletResponse.SC_FORBIDDEN : HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
