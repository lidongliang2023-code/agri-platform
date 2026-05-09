package com.agri.common.security;

import lombok.Data;

import java.io.Serializable;
import java.util.Set;

@Data
public class LoginUser implements Serializable {

    private Long userId;
    private String username;
    private String nickname;
    private String avatar;
    private String tenantId;
    private String deptId;
    private Set<String> roles;
    private Set<String> permissions;
    private String token;

    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }

    public boolean hasPermission(String permission) {
        return permissions != null && permissions.contains(permission);
    }

    public boolean hasAnyRole(String... roleArray) {
        if (roles == null || roleArray == null || roleArray.length == 0) {
            return false;
        }
        for (String role : roleArray) {
            if (roles.contains(role)) {
                return true;
            }
        }
        return false;
    }

    public boolean hasAnyPermission(String... permissionArray) {
        if (permissions == null || permissionArray == null || permissionArray.length == 0) {
            return false;
        }
        for (String permission : permissionArray) {
            if (permissions.contains(permission)) {
                return true;
            }
        }
        return false;
    }
}