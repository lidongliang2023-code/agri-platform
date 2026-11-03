package com.agri.s2b2c.security;

import lombok.Data;

import java.util.Set;

/** 平台令牌解析后的登录用户（只保留业务用得到的字段）。 */
@Data
public class LoginUser {
    private Long userId;
    private String username;
    private Set<String> roles;
}
