package com.agri.platform.internal.permission;

import lombok.Data;

/**
 * 新建平台级角色请求体，对应 {@code POST /api/v1/admin/roles}。
 *
 * <p>角色编码由创建时确定且不可修改：权限码、用户绑定都以 code 为业务主键，
 * 允许改码会让既有授权瞬间悬空。</p>
 */
@Data
public class RoleCreateRequest {

    /** 角色编码，全局唯一，2-64 位字母/数字/下划线/短横线 */
    private String code;

    /** 角色名称，2-128 位 */
    private String name;

    /** 角色说明，可空 */
    private String description;
}
