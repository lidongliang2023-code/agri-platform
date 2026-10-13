package com.agri.trade.common.security;

import lombok.Data;

import java.io.Serializable;
import java.util.Set;

/** 当前登录用户（由平台访问令牌解析而来）。 */
@Data
public class LoginUser implements Serializable {

    private Long userId;
    private String username;
    private String nickname;
    private String tenantId;
    private Set<String> roles;
    private String token;

    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }
}
