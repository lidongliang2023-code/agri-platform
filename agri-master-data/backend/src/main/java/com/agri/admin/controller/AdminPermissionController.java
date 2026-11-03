package com.agri.admin.controller;

import com.agri.admin.dto.PermissionStatisticsDTO;
import com.agri.admin.service.IAdminPermissionService;
import com.agri.admin.vo.OperationLogVO;
import com.agri.admin.vo.OperationLogSummaryVO;
import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.admin.vo.RoleSummaryVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.vo.RoleVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String roleName,
            @RequestParam(required = false) String roleType,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String ownership) {
        return ApiResponse.success(adminPermissionService.getRoleList(
                pageNum, pageSize, keyword, roleName, roleType, status, tenantId, ownership));
    }

    @Operation(summary = "获取角色统计")
    @GetMapping("/role/summary")
    public ApiResponse<RoleSummaryVO> getRoleSummary(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String roleName,
            @RequestParam(required = false) String roleType,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String ownership) {
        return ApiResponse.success(adminPermissionService.getRoleSummary(
                keyword, roleName, roleType, status, tenantId, ownership));
    }

    @Operation(summary = "获取角色详情")
    @GetMapping("/role/{id}")
    public ApiResponse<RoleVO> getRoleDetail(@PathVariable Long id) {
        return ApiResponse.success(adminPermissionService.getRoleDetail(id));
    }

    @Operation(summary = "创建角色")
    @PostMapping("/role")
    public ApiResponse<Long> createRole(@Valid @RequestBody RoleSaveDTO dto) {
        return ApiResponse.success(adminPermissionService.createRole(dto));
    }

    @Operation(summary = "编辑角色")
    @PutMapping("/role/{id}")
    public ApiResponse<Void> updateRole(@PathVariable Long id, @Valid @RequestBody RoleSaveDTO dto) {
        adminPermissionService.updateRole(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除角色")
    @DeleteMapping("/role/{id}")
    public ApiResponse<Void> deleteRole(@PathVariable Long id) {
        adminPermissionService.deleteRole(id);
        return ApiResponse.success();
    }

    @Operation(summary = "启用或停用角色")
    @PutMapping("/role/{id}/status")
    public ApiResponse<Void> updateRoleStatus(@PathVariable Long id, @RequestParam Integer status) {
        adminPermissionService.updateRoleStatus(id, status);
        return ApiResponse.success();
    }

    @Operation(summary = "配置角色权限点（覆盖式）")
    @PutMapping("/role/{id}/menus")
    public ApiResponse<Integer> assignRoleMenus(@PathVariable Long id, @RequestBody List<Long> menuIds) {
        return ApiResponse.success(adminPermissionService.assignRoleMenus(id, menuIds));
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

    @Operation(summary = "获取异常权限检测结果（读扫描结果表；status 默认只看未处置的 OPEN）")
    @GetMapping("/anomaly")
    public ApiResponse<List<PermissionStatisticsVO.AnomalyItem>> getAnomalies(
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminPermissionService.getAnomalies(status));
    }

    @Operation(summary = "立刻执行一次权限巡检（页面「重新检测」与每日定时任务共用同一处实现）")
    @PostMapping("/anomaly/scan")
    public ApiResponse<Map<String, Object>> scanAnomalies() {
        return ApiResponse.success(adminPermissionService.scanAnomalies());
    }

    @Operation(summary = "巡检规则与阈值（页面的「判定口径」按它渲染，不再写死在模板里）")
    @GetMapping("/rules")
    public ApiResponse<List<com.agri.masterdata.entity.PermissionRule>> listPermissionRules() {
        return ApiResponse.success(adminPermissionService.listRules());
    }

    /* ==================== 权限点（按钮级 / API 级） ==================== */

    @Operation(summary = "权限点目录（由真实端点映射同步，只含写方法）")
    @GetMapping("/points")
    public ApiResponse<List<com.agri.masterdata.vo.PermissionVO>> listPoints(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String module) {
        return ApiResponse.success(adminPermissionService.listPermissionPoints(keyword, module));
    }

    @Operation(summary = "同步端点目录（幂等；代码里已消失的端点会被置为下线）")
    @PostMapping("/points/sync")
    public ApiResponse<Map<String, Object>> syncPoints() {
        return ApiResponse.success(adminPermissionService.syncPermissionPoints());
    }

    @Operation(summary = "某角色已持有的权限点 id")
    @GetMapping("/role/{id}/points")
    public ApiResponse<List<String>> getRolePoints(@PathVariable Long id) {
        return ApiResponse.success(adminPermissionService.getRolePoints(id));
    }

    @Operation(summary = "覆盖式保存某角色的权限点授权（勾上即收紧）")
    @PutMapping("/role/{id}/points")
    public ApiResponse<Integer> assignRolePoints(@PathVariable Long id, @RequestBody List<String> permIds) {
        return ApiResponse.success(adminPermissionService.assignRolePoints(id, permIds));
    }

    @Operation(summary = "当前调用者的权限点视图（页面据此决定按钮可见性）")
    @GetMapping("/mine")
    public ApiResponse<Map<String, Object>> myPoints() {
        return ApiResponse.success(adminPermissionService.myPermissionPoints());
    }

    @Operation(summary = "权限点授权申请列表（status 为空则不按状态筛，页面默认选待处理）")
    @GetMapping("/requests")
    public ApiResponse<List<com.agri.masterdata.entity.PermissionRequest>> listRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminPermissionService.listPermissionRequests(status, keyword));
    }

    @Operation(summary = "处理一条授权申请（同意即真的把该点授给申请人的角色）")
    @PutMapping("/requests/{id}/handle")
    public ApiResponse<Map<String, Object>> handleRequest(@PathVariable Long id,
                                                          @RequestBody(required = false) Map<String, Object> body) {
        Object approve = body == null ? null : body.get("approve");
        boolean agreed = approve != null && Boolean.parseBoolean(String.valueOf(approve));
        Object remark = body == null ? null : body.get("remark");
        return ApiResponse.success(adminPermissionService.handlePermissionRequest(
                id, agreed, remark == null ? null : String.valueOf(remark)));
    }

    @Operation(summary = "获取权限分配统计")
    @GetMapping("/statistics")
    public ApiResponse<PermissionStatisticsVO> getStatistics(@RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminPermissionService.getStatistics(tenantId));
    }

    @Operation(summary = "获取操作日志")
    @GetMapping("/operation-log")
    public ApiResponse<PageResult<OperationLogVO>> getOperationLogs(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String operationType,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(adminPermissionService.getOperationLogs(
                pageNum, pageSize, keyword, operationType, module, result, startTime, endTime));
    }

    @Operation(summary = "获取操作日志统计")
    @GetMapping("/operation-log/summary")
    public ApiResponse<OperationLogSummaryVO> getOperationLogSummary(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String operationType,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(adminPermissionService.getOperationLogSummary(
                keyword, operationType, module, result, startTime, endTime));
    }

    @Operation(summary = "获取操作日志模块选项")
    @GetMapping("/operation-log/modules")
    public ApiResponse<List<String>> getOperationLogModules() {
        return ApiResponse.success(adminPermissionService.getOperationLogModules());
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
