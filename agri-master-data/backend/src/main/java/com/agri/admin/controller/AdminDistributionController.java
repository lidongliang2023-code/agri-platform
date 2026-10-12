package com.agri.admin.controller;

import com.agri.admin.service.IAdminDistributionService;
import com.agri.admin.vo.DistributionDetailVO;
import com.agri.admin.vo.DistributionStatisticsVO;
import com.agri.admin.vo.DistributionTaskVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "主数据分发监控")
@RestController
@RequestMapping("/admin/masterdata/distribution")
@RequiredArgsConstructor
public class AdminDistributionController {

    private final IAdminDistributionService adminDistributionService;

    @Operation(summary = "获取分发统计概览")
    @GetMapping("/statistics")
    public ApiResponse<DistributionStatisticsVO> getDistributionStatistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String timeRange) {
        return ApiResponse.success(adminDistributionService.getDistributionStatistics(tenantId, timeRange));
    }

    @Operation(summary = "获取分发任务列表")
    @GetMapping("/tasks")
    public ApiResponse<PageResult<DistributionTaskVO>> getDistributionTasks(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String targetSystem,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminDistributionService.getDistributionTasks(pageNum, pageSize, status, targetSystem, tenantId));
    }

    @Operation(summary = "获取分发任务详情")
    @GetMapping("/tasks/{id}")
    public ApiResponse<DistributionDetailVO> getDistributionDetail(@PathVariable Long id) {
        return ApiResponse.success(adminDistributionService.getDistributionDetail(id));
    }

    @Operation(summary = "重试分发任务")
    @PostMapping("/tasks/{id}/retry")
    public ApiResponse<Void> retryDistribution(@PathVariable Long id) {
        adminDistributionService.retryDistribution(id);
        return ApiResponse.success();
    }

    @Operation(summary = "暂停分发任务")
    @PostMapping("/tasks/{id}/pause")
    public ApiResponse<Void> pauseDistribution(@PathVariable Long id) {
        adminDistributionService.pauseDistribution(id);
        return ApiResponse.success();
    }

    @Operation(summary = "恢复分发任务")
    @PostMapping("/tasks/{id}/resume")
    public ApiResponse<Void> resumeDistribution(@PathVariable Long id) {
        adminDistributionService.resumeDistribution(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取分发趋势")
    @GetMapping("/trend")
    public ApiResponse<List<DistributionStatisticsVO.DistributionTrend>> getDistributionTrend(
            @RequestParam(required = false) String timeRange) {
        return ApiResponse.success(adminDistributionService.getDistributionTrend(timeRange));
    }

    @Operation(summary = "获取目标系统列表")
    @GetMapping("/target-systems")
    public ApiResponse<List<DistributionStatisticsVO.TargetSystem>> getTargetSystems() {
        return ApiResponse.success(adminDistributionService.getTargetSystems());
    }

    @Operation(summary = "导出分发日志")
    @GetMapping("/export")
    public ApiResponse<byte[]> exportDistributionLogs(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(adminDistributionService.exportDistributionLogs(status, startTime, endTime));
    }
}