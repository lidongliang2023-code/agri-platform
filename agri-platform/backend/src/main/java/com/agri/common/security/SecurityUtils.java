package com.agri.common.security;

import com.agri.common.constant.ErrorCode;
import com.agri.common.exception.BusinessException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class SecurityUtils {

    private static final String TOKEN_HEADER = "Authorization";
    private static final String TOKEN_PREFIX = "Bearer ";

    public static HttpServletRequest getRequest() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }

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

    public static Long getUserId() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null ? loginUser.getUserId() : null;
    }

    public static String getUsername() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null ? loginUser.getUsername() : null;
    }

    public static String getTenantId() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null ? loginUser.getTenantId() : null;
    }

    public static Set<String> getRoles() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.getRoles() != null
                ? loginUser.getRoles()
                : Collections.emptySet();
    }

    public static Set<String> getPermissions() {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.getPermissions() != null
                ? loginUser.getPermissions()
                : Collections.emptySet();
    }

    public static LoginUser getLoginUser() {
        return LoginUserHolder.getLoginUser();
    }

    public static boolean isAuthenticated() {
        return getLoginUser() != null;
    }

    public static void checkAuthentication() {
        if (!isAuthenticated()) {
            throw new BusinessException(ErrorCode.USER_NOT_LOGIN);
        }
    }

    public static boolean hasRole(String role) {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.hasRole(role);
    }

    public static boolean hasPermission(String permission) {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.hasPermission(permission);
    }

    public static boolean hasAnyRole(String... roles) {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.hasAnyRole(roles);
    }

    public static boolean hasAnyPermission(String... permissions) {
        LoginUser loginUser = getLoginUser();
        return loginUser != null && loginUser.hasAnyPermission(permissions);
    }

    public static boolean isAdmin() {
        return hasRole("admin");
    }
}
