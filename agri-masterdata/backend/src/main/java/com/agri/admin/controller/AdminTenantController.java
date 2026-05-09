package com.agri.admin.controller;

import com.agri.admin.dto.TenantCreateDTO;
import com.agri.admin.dto.TenantPackageDTO;
import com.agri.admin.dto.TenantQuotaAdjustDTO;
import com.agri.admin.service.IAdminTenantService;
import com.agri.admin.vo.TenantDetailVO;
import com.agri.admin.vo.TenantPackageVO;
import com.agri.admin.vo.TenantStatisticsVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.TenantSaveDTO;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.vo.TenantVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "租户管理")
@RestController
@RequestMapping("/admin/masterdata/tenant")
@RequiredArgsConstructor
public class AdminTenantController {

    private final IAdminTenantService adminTenantService;

    @Operation(summary = "获取租户列表")
    @GetMapping("/list")
    public ApiResponse<PageResult<TenantVO>> getTenantList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String tenantStatus,
            @RequestParam(required = false) String tenantType,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminTenantService.getTenantList(pageNum, pageSize, tenantStatus, tenantType, keyword));
    }

    @Operation(summary = "获取租户详情")
    @GetMapping("/detail/{id}")
    public ApiResponse<TenantDetailVO> getTenantDetail(@PathVariable Long id) {
        return ApiResponse.success(adminTenantService.getTenantDetail(id));
    }

    @Operation(summary = "创建租户")
    @PostMapping
    public ApiResponse<Void> createTenant(@RequestBody TenantCreateDTO dto) {
        adminTenantService.createTenant(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑租户")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateTenant(@PathVariable Long id, @RequestBody TenantUpdateDTO dto) {
        adminTenantService.updateTenant(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除租户")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteTenant(@PathVariable Long id) {
        adminTenantService.deleteTenant(id);
        return ApiResponse.success();
    }

    @Operation(summary = "停用/启用租户")
    @PutMapping("/{id}/status")
    public ApiResponse<Void> updateTenantStatus(@PathVariable Long id, @RequestParam Integer status) {
        adminTenantService.updateTenantStatus(id, status);
        return ApiResponse.success();
    }

    @Operation(summary = "获取租户配额")
    @GetMapping("/{id}/quota")
    public ApiResponse<TenantDetailVO.QuotaInfo> getTenantQuota(@PathVariable Long id) {
        return ApiResponse.success(adminTenantService.getTenantQuota(id));
    }

    @Operation(summary = "调整租户配额")
    @PutMapping("/{id}/quota")
    public ApiResponse<Void> adjustTenantQuota(@PathVariable Long id, @RequestBody TenantQuotaAdjustDTO dto) {
        adminTenantService.adjustTenantQuota(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "设置配额预警阈值")
    @PutMapping("/{id}/quota/alert-threshold")
    public ApiResponse<Void> setAlertThreshold(@PathVariable Long id, @RequestParam Integer threshold) {
        adminTenantService.setAlertThreshold(id, threshold);
        return ApiResponse.success();
    }

    @Operation(summary = "获取租户套餐列表")
    @GetMapping("/package/list")
    public ApiResponse<List<TenantPackageVO>> getPackageList() {
        return ApiResponse.success(adminTenantService.getPackageList());
    }

    @Operation(summary = "创建租户套餐")
    @PostMapping("/package")
    public ApiResponse<Void> createPackage(@RequestBody TenantPackageDTO dto) {
        adminTenantService.createPackage(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑租户套餐")
    @PutMapping("/package/{id}")
    public ApiResponse<Void> updatePackage(@PathVariable Long id, @RequestBody TenantPackageDTO dto) {
        adminTenantService.updatePackage(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除租户套餐")
    @DeleteMapping("/package/{id}")
    public ApiResponse<Void> deletePackage(@PathVariable Long id) {
        adminTenantService.deletePackage(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取租户统计数据")
    @GetMapping("/statistics")
    public ApiResponse<TenantStatisticsVO> getTenantStatistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String timeRange) {
        return ApiResponse.success(adminTenantService.getTenantStatistics(tenantId, timeRange));
    }

    @Operation(summary = "获取租户统计汇总")
    @GetMapping("/statistics/summary")
    public ApiResponse<TenantStatisticsVO.Summary> getTenantSummary() {
        return ApiResponse.success(adminTenantService.getTenantSummary());
    }
}