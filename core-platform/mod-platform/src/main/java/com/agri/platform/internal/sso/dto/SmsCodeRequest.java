package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 发送手机验证码请求（2026-10-16）。

 *
 * @param phone 手机号
 * @param scene 场景：{@code login} 登录 / {@code register} 注册 / {@code change_phone} 更换手机（场景码互不通用）
 */
public record SmsCodeRequest(
        @NotBlank(message = "手机号不能为空") String phone,
        @NotBlank(message = "场景不能为空") String scene) {
}
