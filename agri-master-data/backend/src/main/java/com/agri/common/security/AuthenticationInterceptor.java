package com.agri.common.security;

import com.agri.common.constant.ErrorCode;
import com.agri.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Slf4j
@Component
public class AuthenticationInterceptor implements HandlerInterceptor {

    private final TokenService tokenService;

    public AuthenticationInterceptor(TokenService tokenService) {
        this.tokenService = tokenService;
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

        if (!tokenService.validateToken(token)) {
            log.debug("Invalid or expired token");
            throw new BusinessException(ErrorCode.USER_TOKEN_INVALID);
        }

        LoginUser loginUser = tokenService.parseToken(token);
        if (loginUser == null) {
            throw new BusinessException(ErrorCode.USER_TOKEN_EXPIRED);
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
