package com.agri.trade.common.security;

import com.agri.trade.security.PlatformTokenService;
import com.agri.trade.service.OperatorPermissionService;
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

    /** 运营端接口前缀。 */
    private static final String OPERATOR_PATH_PREFIX = "/api/trade/admin/";

    private final PlatformTokenService platformTokenService;
    private final OperatorPermissionService operatorPermissionService;

    public AuthenticationInterceptor(PlatformTokenService platformTokenService,
                                     OperatorPermissionService operatorPermissionService) {
        this.platformTokenService = platformTokenService;
        this.operatorPermissionService = operatorPermissionService;
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

        LoginUserHolder.setLoginUser(loginUser);

        // ---- 授权（谁能调）----
        //
        // 运营端的准入分两种来源，合起来才没有漏网：
        //   ① 路径前缀 /api/trade/admin/** —— 运营端各页面的接口族，要 trade:read；
        //   ② 方法/类上的 @OperatorOnly —— 挂在业务路径上的运营动作（退款审核、
        //      纠纷调解/仲裁、赔付审核与打款）。这些天然属于"某张订单/某场纠纷"的资源，
        //      不可能都挪到 /admin 下，只按前缀拦会漏掉最要命的口子（打款、退款是真金白银）。
        //
        // 判定用平台的 RBAC（platform_user_role ⋈ platform_role.permissions，
        // 按令牌 + 当前市场实时解析），而不是只看令牌里的角色摘要 ——
        // 架构文档 V2.0 5.5：细权限以后端实时鉴权为准。平台不可达时拒绝，不放行。
        String required = requiredPermission(request, handler);
        if (required != null) {
            OperatorPermissionService.Decision decision = operatorPermissionService.check(required);
            if (!decision.allowed()) {
                log.warn("运营权限不足被拒：user={} uri={} required={} reason={}",
                        loginUser.getUsername(), request.getRequestURI(), required, decision.message());
                return reject(response, 403, decision.message());
            }
        }

        log.debug("已认证：{}", loginUser.getUsername());
        return true;
    }

    /** 这个请求需要哪个权限码；普通业务接口返回 null（由各自的身份判权负责）。 */
    private String requiredPermission(HttpServletRequest request, Object handler) {
        OperatorOnly annotation = ((HandlerMethod) handler).getMethodAnnotation(OperatorOnly.class);
        if (annotation == null) {
            annotation = ((HandlerMethod) handler).getBeanType().getAnnotation(OperatorOnly.class);
        }
        if (annotation != null) {
            return annotation.value();
        }
        return request.getRequestURI().startsWith(OPERATOR_PATH_PREFIX) ? "trade:read" : null;
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
