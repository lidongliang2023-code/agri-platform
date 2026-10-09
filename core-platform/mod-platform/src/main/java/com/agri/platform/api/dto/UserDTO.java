package com.agri.platform.api.dto;

/**
 * 用户 DTO（OHS 对外契约）。
 */
public record UserDTO(Long id, String username, String nickname, String phone, Integer status) {
}
