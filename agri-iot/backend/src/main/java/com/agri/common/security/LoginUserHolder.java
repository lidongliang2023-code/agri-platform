package com.agri.common.security;

public class LoginUserHolder {

    private static final ThreadLocal<LoginUser> loginUserThreadLocal = new ThreadLocal<>();

    public static void setLoginUser(LoginUser loginUser) {
        loginUserThreadLocal.set(loginUser);
    }

    public static LoginUser getLoginUser() {
        return loginUserThreadLocal.get();
    }

    public static void removeLoginUser() {
        loginUserThreadLocal.remove();
    }

    public static void clear() {
        loginUserThreadLocal.remove();
    }
}