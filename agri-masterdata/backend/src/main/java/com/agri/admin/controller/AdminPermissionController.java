package com.agri.admin.controller;

import com.agri.admin.dto.PermissionStatisticsDTO;
import com.agri.admin.service.IAdminPermissionService;
import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.vo.RoleVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "权限审计")
@RestController
@RequestMapping("/admin/masterdata/permission")
@RequiredArgsConstructor
public class AdminPermissionController {

    private final IAdminPermissionService adminPermissionService;

    @Operation(summary = "获取角色列表")
    @GetMapping("/role/list")
    public ApiResponse<PageResult<RoleVO>> getRoleList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String roleName,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminPermissionService.getRoleList(pageNum, pageSize, roleName, tenantId));
    }

    @Operation(summary = "获取角色详情")
    @GetMapping("/role/{id}")
    public ApiResponse<RoleVO> getRoleDetail(@PathVariable Long id) {
        return ApiResponse.success(adminPermissionService.getRoleDetail(id));
    }

    @Operation(summary = "创建角色")
    @PostMapping("/role")
    public ApiResponse<Void> createRole(@RequestBody RoleSaveDTO dto) {
        adminPermissionService.createRole(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑角色")
    @PutMapping("/role/{id}")
    public ApiResponse<Void> updateRole(@PathVariable Long id, @RequestBody RoleSaveDTO dto) {
        adminPermissionService.updateRole(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除角色")
    @DeleteMapping("/role/{id}")
    public ApiResponse<Void> deleteRole(@PathVariable Long id) {
        adminPermissionService.deleteRole(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取权限变更记录")
    @GetMapping("/change-log")
    public ApiResponse<PageResult<PermissionChangeLogVO>> getChangeLogs(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String changeType,
            @RequestParam(required = false) String operator,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(adminPermissionService.getChangeLogs(pageNum, pageSize, changeType, operator, startTime, endTime));
    }

    @Operation(summary = "获取异常权限检测结果")
    @GetMapping("/anomaly")
    public ApiResponse<List<PermissionStatisticsVO.AnomalyItem>> getAnomalies() {
        return ApiResponse.success(adminPermissionService.getAnomalies());
    }

    @Operation(summary = "获取权限分配统计")
    @GetMapping("/statistics")
    public ApiResponse<PermissionStatisticsVO> getStatistics(@RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminPermissionService.getStatistics(tenantId));
    }

    @Operation(summary = "获取操作日志")
    @GetMapping("/operation-log")
    public ApiResponse<PageResult<PermissionChangeLogVO>> getOperationLogs(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String operator,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(adminPermissionService.getOperationLogs(pageNum, pageSize, operator, module, startTime, endTime));
    }

    @Operation(summary = "导出权限变更记录")
    @GetMapping("/export")
    public ApiResponse<byte[]> exportChangeLogs(
            @RequestParam(required = false) String changeType,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(adminPermissionService.exportChangeLogs(changeType, startTime, endTime));
    }
}