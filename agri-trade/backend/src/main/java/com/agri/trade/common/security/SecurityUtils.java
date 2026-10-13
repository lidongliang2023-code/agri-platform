package com.agri.trade.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Collections;
import java.util.Set;

/** 读取当前请求的身份信息。业务代码统一走这里，不直接读 Header、不直接碰 ThreadLocal。 */
public final class SecurityUtils {

    private static final String TOKEN_HEADER = "Authorization";
    private static final String TOKEN_PREFIX = "Bearer ";

    private SecurityUtils() {
    }

    public static HttpServletRequest getRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }

    /** 取令牌本体（去掉 "Bearer " 前缀）。 */
    public static String getToken() {
        HttpServletRequest request = getRequest();
        if (request == null) {
            return null;
        }
        String token = request.getHeader(TOKEN_HEADER);
        if (token != null && token.startsWith(TOKEN_PREFIX)) {
            return token.substring(TOKEN_PREFIX.length());
        }
        return null;
    }

    public static LoginUser getLoginUser() {
        return LoginUserHolder.getLoginUser();
    }

    public static Long getUserId() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null ? loginUser.getUserId() : null;
    }

    public static String getUsername() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null ? loginUser.getUsername() : null;
    }

    public static Set<String> getRoles() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.getRoles() != null
                ? loginUser.getRoles()
                : Collections.emptySet();
    }

    public static boolean isAuthenticated() {
        return getLoginUser() != null;
    }

    public static boolean hasRole(String role) {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.hasRole(role);
    }
}
