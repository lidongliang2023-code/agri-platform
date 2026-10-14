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

        LoginUserHolder.setLoginUser(loginUser);
        // 授权（运营端准入）不在这里：它统一由 agri-common 的 OperatorGuardInterceptor 处理
        // （路径前缀按方法要读/写权限 + @OperatorOnly 标注的运营动作），
        // 与其它子系统共用一份实现。这个拦截器只回答"你是谁"。
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
