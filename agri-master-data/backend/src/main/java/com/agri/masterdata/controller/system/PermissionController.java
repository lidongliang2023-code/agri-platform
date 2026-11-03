package com.agri.masterdata.controller.system;

import com.agri.common.exception.BusinessException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 旧权限点接口（<b>已下线</b>，保留是为了让调用方拿到明确结论而不是 404）。
 *
 * <p>这一组端点以前有三重问题：① 挂在 {@code /api/master-data/**} 下，
 * 不在 {@code platform.rbac.operator-paths} 里，所以<b>只验登录、不验权限</b>，
 * 任何登录者都能 PUT 改授权；② 它调的服务依赖三个没有 XML 的自定义查询，
 * 一调就抛 "Invalid bound statement"，从未真的工作过；③ 全仓没有任何前端或脚本调用它。
 * 与其让它"忽然能用"变成一条无人看守的写入口，不如显式拒绝并指路。</p>
 *
 * <p>现在的入口都在运营端（受 RBAC 守卫）：
 * {@code GET/POST /admin/masterdata/permission/points[/sync]}、
 * {@code GET/PUT /admin/masterdata/permission/role/{id}/points}、
 * {@code GET /admin/masterdata/permission/mine}。</p>
 */
@Tag(name = "权限点（旧入口，已下线）")
@RestController
@RequestMapping("/api/master-data")
public class PermissionController {

    private static final String GONE = "旧权限点接口已下线：这条路径不在运营端 RBAC 覆盖范围内，"
            + "且其服务依赖的三个自定义查询从来没有 XML（一调即 500）。"
            + "请改用 /admin/masterdata/permission/points 与 /admin/masterdata/permission/role/{id}/points";

    @Operation(summary = "权限树（已下线）")
    @GetMapping("/permissions/tree")
    public Object getPermissionTree() {
        throw new BusinessException(410, GONE);
    }

    @Operation(summary = "权限点详情（已下线）")
    @GetMapping("/permissions/{permissionId}")
    public Object getById(@PathVariable String permissionId) {
        throw new BusinessException(410, GONE);
    }

    @Operation(summary = "角色权限点（已下线）")
    @GetMapping("/roles/{roleId}/permissions")
    public Object getRolePermissions(@PathVariable String roleId) {
        throw new BusinessException(410, GONE);
    }

    @Operation(summary = "保存角色权限点（已下线，改走运营端接口）")
    @PutMapping("/roles/{roleId}/permissions")
    public Object assignRolePermissions(@PathVariable String roleId, @RequestBody List<String> permissionIds) {
        throw new BusinessException(410, GONE);
    }

    @Operation(summary = "校验权限点（已下线）")
    @PostMapping("/permissions/check")
    public Object checkPermission(@RequestBody Map<String, String> params) {
        throw new BusinessException(410, GONE);
    }
}
