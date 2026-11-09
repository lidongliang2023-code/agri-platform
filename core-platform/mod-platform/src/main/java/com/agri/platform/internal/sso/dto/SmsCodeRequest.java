package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 发送手机验证码请求（2026-10-16）。

 *
 * @param phone 手机号
 * @param scene 场景：{@code login} 登录 / {@code register} 注册 / {@code reset_password} 找回密码。
 *              <b>本端点是公开端点，只接受这三种</b>；换绑手机（{@code change_phone}）
 *              要走 {@code POST /api/v1/sso/account/phone/code}（需要登录态），
 *              否则任何人都能替别人的号码发码。场景码互不通用。
 */
public record SmsCodeRequest(
        @NotBlank(message = "手机号不能为空") String phone,
        @NotBlank(message = "场景不能为空") String scene) {
}
