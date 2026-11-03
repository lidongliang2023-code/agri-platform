package com.agri.s2b2c.security;

/**
 * 当前请求的登录用户（由 {@link AuthenticationInterceptor} 写入）。
 */
public final class SecurityUtils {

    private static final ThreadLocal<LoginUser> HOLDER = new ThreadLocal<>();
    private static final ThreadLocal<String> TOKEN = new ThreadLocal<>();

    private SecurityUtils() {
    }

    public static void set(LoginUser user) {
        HOLDER.set(user);
    }

    public static void setToken(String token) {
        TOKEN.set(token);
    }

    public static String getToken() {
        return TOKEN.get();
    }

    public static LoginUser getLoginUser() {
        return HOLDER.get();
    }

    public static Long getUserId() {
        LoginUser user = HOLDER.get();
        return user == null ? null : user.getUserId();
    }

    public static String getUsername() {
        LoginUser user = HOLDER.get();
        return user == null ? null : user.getUsername();
    }

    public static void clear() {
        HOLDER.remove();
        TOKEN.remove();
    }
}
