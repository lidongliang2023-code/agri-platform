package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.IOperationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trade/operation")
@RequiredArgsConstructor
public class OperationController {

    private final IOperationService operationService;

    @GetMapping("/dashboard")
    public ApiResponse<IOperationService.OperationDashboard> getOperationDashboard() {
        return ApiResponse.success(operationService.getOperationDashboard());
    }

    @GetMapping("/overview")
    public ApiResponse<IOperationService.TransactionOverview> getTransactionOverview(
            @RequestParam(defaultValue = "7") int days) {
        return ApiResponse.success(operationService.getTransactionOverview(days));
    }

    @GetMapping("/category-stats")
    public ApiResponse<List<IOperationService.CategoryStats>> getCategoryStats() {
        return ApiResponse.success(operationService.getCategoryStats());
    }

    @GetMapping("/region-stats")
    public ApiResponse<List<IOperationService.RegionStats>> getRegionStats() {
        return ApiResponse.success(operationService.getRegionStats());
    }

    @GetMapping("/risk/alerts")
    public ApiResponse<List<IOperationService.RiskAlert>> getRiskAlerts() {
        return ApiResponse.success(operationService.getRiskAlerts());
    }

    @GetMapping("/risk/alerts/{alertId}")
    public ApiResponse<IOperationService.RiskAlert> getRiskAlert(@PathVariable Long alertId) {
        IOperationService.RiskAlert alert = operationService.getRiskAlert(alertId);
        if (alert == null) {
            return ApiResponse.error("预警不存在");
        }
        return ApiResponse.success(alert);
    }

    @PostMapping("/risk/alerts/{alertId}/handle")
    public ApiResponse<Boolean> handleRiskAlert(
            @PathVariable Long alertId,
            @RequestBody Map<String, String> request) {
        String handleResult = request.get("handleResult");
        String handleRemark = request.get("handleRemark");
        boolean result = operationService.handleRiskAlert(alertId, handleResult, handleRemark);
        return result ? ApiResponse.success(true) : ApiResponse.error("处理失败");
    }

    @GetMapping("/risk/rules")
    public ApiResponse<List<IOperationService.RiskRule>> getRiskRules() {
        return ApiResponse.success(operationService.getRiskRules());
    }

    @PostMapping("/risk/rules")
    public ApiResponse<IOperationService.RiskRule> addRiskRule(
            @RequestBody IOperationService.RiskRule rule) {
        return ApiResponse.success(operationService.addRiskRule(rule));
    }

    @PutMapping("/risk/rules")
    public ApiResponse<Boolean> updateRiskRule(
            @RequestBody IOperationService.RiskRule rule) {
        return ApiResponse.success(operationService.updateRiskRule(rule));
    }

    @DeleteMapping("/risk/rules/{ruleId}")
    public ApiResponse<Boolean> deleteRiskRule(@PathVariable Long ruleId) {
        return ApiResponse.success(operationService.deleteRiskRule(ruleId));
    }

    @GetMapping("/health")
    public ApiResponse<Map<String, Object>> getSystemHealth() {
        return ApiResponse.success(operationService.getSystemHealth());
    }
}