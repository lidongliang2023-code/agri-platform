package com.agri.platform.internal.permission;

import lombok.Data;

/**
 * 编辑平台级角色请求体，对应 {@code PUT /api/v1/admin/roles/{code}}。
 *
 * <p>只允许改名称、说明与启停状态；编码、权限码不在这个接口里改
 * （权限走 {@code PUT /{code}/permissions}，编码视为不可变业务主键）。</p>
 */
@Data
public class RoleUpdateRequest {

    /** 角色名称 */
    private String name;

    /** 角色说明 */
    private String description;

    /** enabled / disabled；为空表示不修改 */
    private String status;
}
