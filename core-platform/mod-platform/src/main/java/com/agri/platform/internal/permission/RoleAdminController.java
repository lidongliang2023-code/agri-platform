package com.agri.platform.internal.permission;

import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    private final RoleMapper roleMapper;
    private final RolePermissionService rolePermissionService;

    /** 角色列表 */
    @GetMapping
    public ApiResponse<List<RoleEntity>> list() {
        return ApiResponse.ok(roleMapper.selectList(null));
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
