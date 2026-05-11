package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IAnalyticsService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/analytics")
public class AnalyticsController {

    private final IAnalyticsService analyticsService;

    public AnalyticsController(IAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> getOverview() {
        String tenantId = "T001";
        Map<String, Object> result = analyticsService.getProductionOverview(tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/tasks")
    public ApiResponse<Map<String, Object>> getTaskStatistics() {
        String tenantId = "T001";
        Map<String, Object> result = analyticsService.getTaskStatistics(tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/harvests")
    public ApiResponse<Map<String, Object>> getHarvestStatistics() {
        String tenantId = "T001";
        Map<String, Object> result = analyticsService.getHarvestStatistics(tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/inputs")
    public ApiResponse<Map<String, Object>> getInputStatistics() {
        String tenantId = "T001";
        Map<String, Object> result = analyticsService.getInputMaterialStatistics(tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/farm/{farmId}")
    public ApiResponse<Map<String, Object>> getFarmDashboard(@PathVariable Long farmId) {
        String tenantId = "T001";
        Map<String, Object> result = analyticsService.getFarmDashboard(tenantId, farmId);
        return ApiResponse.success(result);
    }
}