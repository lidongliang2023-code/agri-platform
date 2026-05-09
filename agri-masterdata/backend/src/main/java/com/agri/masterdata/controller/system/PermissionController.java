package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.service.IPermissionService;
import com.agri.masterdata.vo.PermissionVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/master-data")
@RequiredArgsConstructor
public class PermissionController {

    private final IPermissionService permissionService;

    @GetMapping("/permissions/tree")
    public ApiResponse<List<PermissionVO>> getPermissionTree() {
        List<PermissionVO> tree = permissionService.getPermissionTree();
        return ApiResponse.success(tree);
    }

    @GetMapping("/permissions/{permissionId}")
    public ApiResponse<PermissionVO> getById(@PathVariable String permissionId) {
        PermissionVO permission = permissionService.getById(permissionId);
        return ApiResponse.success(permission);
    }

    @GetMapping("/roles/{roleId}/permissions")
    public ApiResponse<List<PermissionVO>> getRolePermissions(@PathVariable String roleId) {
        List<PermissionVO> permissions = permissionService.getRolePermissions(roleId);
        return ApiResponse.success(permissions);
    }

    @PutMapping("/roles/{roleId}/permissions")
    public ApiResponse<Void> assignRolePermissions(@PathVariable String roleId, @RequestBody List<String> permissionIds) {
        permissionService.assignRolePermissions(roleId, permissionIds);
        return ApiResponse.success();
    }

    @PostMapping("/permissions/check")
    public ApiResponse<Boolean> checkPermission(@RequestBody Map<String, String> params) {
        String userId = params.get("userId");
        String permission = params.get("permission");
        boolean hasPermission = permissionService.checkPermission(userId, permission);
        return ApiResponse.success(hasPermission);
    }
}