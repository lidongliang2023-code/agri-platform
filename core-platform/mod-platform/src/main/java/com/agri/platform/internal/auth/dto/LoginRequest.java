package com.agri.platform.internal.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 登录请求：用户选择进入的市场（ADR-005 用户×角色×市场）。
 */
public record LoginRequest(
        @NotBlank(message = "用户名不能为空") String username,
        @NotBlank(message = "密码不能为空") String password,
        Long marketId) {
}
