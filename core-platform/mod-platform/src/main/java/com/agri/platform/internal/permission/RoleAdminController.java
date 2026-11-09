package com.agri.platform.internal.permission;

import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 平台域角色管理（{@code /api/v1/admin/roles}）。
 *
 * <p>权限读写必须落在这里而不是生产域：{@code platform_role} 是平台域表，
 * 按 ADR-001 表前缀隔离纪律，mod-produce 不得写 {@code platform_} 表。</p>
 */
@RestController
@RequestMapping("/api/v1/admin/roles")
@RequiredArgsConstructor
public class RoleAdminController {

    private final RoleAdminService roleAdminService;
    private final RolePermissionService rolePermissionService;

    /** 角色列表（含成员数、状态、更新时间） */
    @GetMapping
    public ApiResponse<List<RoleEntity>> list() {
        return ApiResponse.ok(roleAdminService.list());
    }

    /**
     * 新建平台级角色。
     *
     * @param request 编码/名称/说明
     * @return 新建后的角色
     */
    @PostMapping
    public ApiResponse<RoleEntity> create(@RequestBody(required = false) RoleCreateRequest request) {
        return ApiResponse.ok(roleAdminService.create(request));
    }

    /**
     * 编辑角色名称/说明/启停状态；编码不可改。
     *
     * @param code    角色编码
     * @param request 待更新字段
     * @return 更新后的角色
     */
    @PutMapping("/{code}")
    public ApiResponse<RoleEntity> update(@PathVariable String code,
                                          @RequestBody(required = false) RoleUpdateRequest request) {
        return ApiResponse.ok(roleAdminService.update(code, request));
    }

    /**
     * 删除角色：内置角色、仍被用户绑定的角色会被明确阻断。
     *
     * @param code 角色编码
     */
    @DeleteMapping("/{code}")
    public ApiResponse<Void> delete(@PathVariable String code) {
        roleAdminService.delete(code);
        return ApiResponse.ok(null);
    }

    /**
     * 读取角色已配置的权限码（回读校验用：写入后调它能证明真的落库了）。
     *
     * @param code 角色编码
     * @return 权限码列表
     */
    @GetMapping("/{code}/permissions")
    public ApiResponse<List<String>> permissions(@PathVariable String code) {
        return ApiResponse.ok(rolePermissionService.permissions(code));
    }

    /**
     * 覆盖写入角色权限码。角色不存在即明确失败（404），绝不静默创建、绝不假装成功。
     *
     * @param code    角色编码
     * @param request 权限码数组（{@code permissions} 或 {@code permissionIds}）
     * @return 更新后的角色
     */
    @PutMapping("/{code}/permissions")
    public ApiResponse<RoleEntity> updatePermissions(@PathVariable String code,
                                                     @RequestBody(required = false) RolePermissionRequest request) {
        return ApiResponse.ok(rolePermissionService.updatePermissions(code, request));
    }
}
