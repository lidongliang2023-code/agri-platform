package com.agri.admin.controller;

import com.agri.admin.service.IAdminQualityService;
import com.agri.admin.vo.QualityDetailVO;
import com.agri.admin.vo.QualityIssueVO;
import com.agri.admin.vo.QualityStatisticsVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "数据质量监控")
@RestController
@RequestMapping("/admin/masterdata/quality")
@RequiredArgsConstructor
public class AdminQualityController {

    private final IAdminQualityService adminQualityService;

    @Operation(summary = "获取质量统计概览")
    @GetMapping("/statistics")
    public ApiResponse<QualityStatisticsVO> getQualityStatistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String timeRange) {
        return ApiResponse.success(adminQualityService.getQualityStatistics(tenantId, timeRange));
    }

    @Operation(summary = "获取质量问题列表")
    @GetMapping("/issues")
    public ApiResponse<PageResult<QualityIssueVO>> getQualityIssues(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminQualityService.getQualityIssues(pageNum, pageSize, severity, domain, status, tenantId));
    }

    @Operation(summary = "获取质量问题详情")
    @GetMapping("/issues/{id}")
    public ApiResponse<QualityDetailVO> getQualityDetail(@PathVariable Long id) {
        return ApiResponse.success(adminQualityService.getQualityDetail(id));
    }

    @Operation(summary = "处理质量问题")
    @PutMapping("/issues/{id}/handle")
    public ApiResponse<Void> handleQualityIssue(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String remark) {
        adminQualityService.handleQualityIssue(id, status, remark);
        return ApiResponse.success();
    }

    @Operation(summary = "批量处理质量问题")
    @PutMapping("/issues/batch-handle")
    public ApiResponse<Void> batchHandleQualityIssues(
            @RequestBody List<Long> ids,
            @RequestParam String status,
            @RequestParam(required = false) String remark) {
        adminQualityService.batchHandleQualityIssues(ids, status, remark);
        return ApiResponse.success();
    }

    @Operation(summary = "获取质量问题趋势")
    @GetMapping("/trend")
    public ApiResponse<List<QualityStatisticsVO.QualityTrend>> getQualityTrend(
            @RequestParam(required = false) String timeRange,
            @RequestParam(required = false) String domain) {
        return ApiResponse.success(adminQualityService.getQualityTrend(timeRange, domain));
    }

    @Operation(summary = "导出质量问题")
    @GetMapping("/export")
    public ApiResponse<byte[]> exportQualityIssues(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminQualityService.exportQualityIssues(severity, status));
    }
}