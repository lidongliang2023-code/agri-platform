package com.agri.common.security;

import com.agri.common.constant.ErrorCode;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.security.PlatformTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 认证拦截器 —— 一次请求只在这里判定身份。
 *
 * <p><b>令牌来源有两条，优先级明确</b>（迁移窗口内的显式兼容，不是"两个都能用"的含糊状态）：</p>
 * <ol>
 *   <li><b>平台访问令牌</b>（{@link PlatformTokenService}，V2.0 第 5.2 节第 ⑨ 步：
 *       网关验签后微服务据此处理）。SSO 登录后拿到的就是这种令牌，无状态、不查 Redis。</li>
 *   <li><b>私有会话令牌</b>（{@link TokenService}，要求令牌在自身 Redis 里）。
 *       存量 /api/* 接口族仍在用，迁移完成前保留。</li>
 * </ol>
 *
 * <p>为什么先判平台令牌：两者用不同密钥签名，验签一定互斥，先后只影响日志可读性；
 * 但把平台令牌排在前面，能让"平台令牌被误判"这类问题在日志里一眼看出来。</p>
 */
@Slf4j
@Component
public class AuthenticationInterceptor implements HandlerInterceptor {

    private final TokenService tokenService;
    private final PlatformTokenService platformTokenService;

    public AuthenticationInterceptor(TokenService tokenService, PlatformTokenService platformTokenService) {
        this.tokenService = tokenService;
        this.platformTokenService = platformTokenService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof org.springframework.web.method.HandlerMethod)) {
            return true;
        }

        String token = SecurityUtils.getToken();

        if (token == null || token.isEmpty()) {
            log.debug("No token found in request");
            throw new BusinessException(ErrorCode.USER_NOT_LOGIN);
        }

        LoginUser loginUser = platformTokenService.parse(token);
        if (loginUser == null) {
            // 平台令牌解析失败才回落到私有令牌：两条链路都不过就是令牌真的无效
            if (tokenService.validateToken(token)) {
                loginUser = tokenService.parseToken(token);
            }
        }
        if (loginUser == null) {
            log.debug("Invalid or expired token");
            throw new BusinessException(ErrorCode.USER_TOKEN_INVALID);
        }

        LoginUserHolder.setLoginUser(loginUser);
        log.debug("User authenticated: {}", loginUser.getUsername());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                 Object handler, Exception ex) {
        LoginUserHolder.removeLoginUser();
    }
}
