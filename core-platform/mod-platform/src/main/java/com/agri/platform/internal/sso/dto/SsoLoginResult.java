package com.agri.platform.internal.sso.dto;

// SSO 登录结果：登录页据此整页跳转（回跳地址里已带着 code 与 state）。
//
// 回跳地址由服务端拼好，而不是把 code 交给登录页去拼 —— 少一处拼接就少一处出错面，
// 也让「state 原样回传」这件事只在一处实现。
public record SsoLoginResult(String redirect, String stage) {

    /** 兼容不关心开通阶段的旧调用方。 */
    public SsoLoginResult(String redirect) {
        this(redirect, null);
    }
}
