package com.agri.admin.controller;

import com.agri.admin.service.IDashboardService;
import com.agri.admin.vo.DashboardVO;
import com.agri.admin.vo.HealthDashboardVO;
import com.agri.admin.vo.TenantActivityVO;
import com.agri.common.entity.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "运营总览")
@RestController
@RequestMapping("/admin/masterdata/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final IDashboardService dashboardService;

    @Operation(summary = "获取运营数据总览")
    @GetMapping
    public ApiResponse<DashboardVO> getDashboard(@RequestParam(required = false) String timeRange) {
        return ApiResponse.success(dashboardService.getDashboard(timeRange));
    }

    @Operation(summary = "获取健康度仪表盘")
    @GetMapping("/health")
    public ApiResponse<HealthDashboardVO> getHealthDashboard() {
        return ApiResponse.success(dashboardService.getHealthDashboard());
    }

    @Operation(summary = "获取租户活跃度排行")
    @GetMapping("/tenant-activity")
    public ApiResponse<List<TenantActivityVO>> getTenantActivity(@RequestParam(defaultValue = "10") Integer limit) {
        return ApiResponse.success(dashboardService.getTenantActivity(limit));
    }

    @Operation(summary = "获取预警列表")
    @GetMapping("/alerts")
    public ApiResponse<List<DashboardVO.AlertItem>> getAlerts(@RequestParam(defaultValue = "5") Integer limit) {
        return ApiResponse.success(dashboardService.getAlerts(limit));
    }

    @Operation(summary = "获取待审核事项")
    @GetMapping("/pending-audit")
    public ApiResponse<DashboardVO.PendingAudit> getPendingAudit() {
        return ApiResponse.success(dashboardService.getPendingAudit());
    }
}