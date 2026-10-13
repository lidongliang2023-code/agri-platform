package com.agri.trade.common.security;

/**
 * 登录用户的线程上下文。
 *
 * <p>请求线程内由 {@link AuthenticationInterceptor} 写入、请求结束时清除；
 * 业务代码通过 {@link SecurityUtils} 读，不直接碰这个 ThreadLocal ——
 * 一旦有人忘了 clear，上一个请求的身份就会泄漏给下一个请求。</p>
 */
public final class LoginUserHolder {

    private static final ThreadLocal<LoginUser> HOLDER = new ThreadLocal<>();

    private LoginUserHolder() {
    }

    public static void setLoginUser(LoginUser loginUser) {
        HOLDER.set(loginUser);
    }

    public static LoginUser getLoginUser() {
        return HOLDER.get();
    }

    public static void removeLoginUser() {
        HOLDER.remove();
    }
}
