package com.agri.platform.internal.permission;

import lombok.Data;

import java.util.List;

/**
 * 角色权限写入请求体，对应 {@code PUT /api/v1/admin/roles/{code}/permissions}。
 *
 * <p>两个字段名都收：{@code permissions} 是与 {@code platform_role.permissions} 列对齐的规范名，
 * {@code permissionIds} 是前端既有 payload 用的名字（{@code production-view.ts saveRolePermissions}
 * 发的是 {@code {permissionIds: string[]}}）。同时兼容是为了让前端只改路径、不必再猜字段名；
 * 两者都传时以 {@code permissions} 为准。</p>
 */
@Data
public class RolePermissionRequest {

    /** 权限码数组（规范字段名） */
    private List<String> permissions;

    /** 权限码数组（前端既有字段名的兼容别名） */
    private List<String> permissionIds;

    /**
     * 取实际生效的权限码数组。
     *
     * @return 权限码数组；两者都没传时返回 {@code null}，由调用方显式判失败
     */
    public List<String> resolve() {
        if (permissions != null) {
            return permissions;
        }
        return permissionIds;
    }
}
