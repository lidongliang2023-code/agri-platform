package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.HarvestWindowService;
import com.agri.production.service.HarvestWeatherService;
import com.agri.production.service.HarvestFaultRescheduleService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 采收窗口决策与用工协同排程接口。 */
@RestController
@RequestMapping("/api/v1/production/harvest-window")
public class HarvestWindowController {
    private final HarvestWindowService service;

    private final HarvestFaultRescheduleService reschedule;
    private final HarvestWeatherService weather;
    private final com.agri.production.service.HarvestRiskBatchPreviewService riskPreview;
    public HarvestWindowController(HarvestWindowService service, HarvestFaultRescheduleService reschedule, HarvestWeatherService weather, com.agri.production.service.HarvestRiskBatchPreviewService riskPreview) {
        this.service = service;
        this.reschedule = reschedule;
        this.weather = weather;
        this.riskPreview = riskPreview;
    }

    @PostMapping("/plans/{id}/fault-reschedule/preview")
    public ApiResponse<Map<String, Object>> previewReschedule(@PathVariable String id, @RequestBody Map<String,Object> request) {
        return ApiResponse.success(reschedule.preview(TenantContextService.currentTenantId(), id, request));
    }

    @PostMapping("/plans/{id}/fault-reschedule/apply")
    public ApiResponse<Map<String, Object>> applyReschedule(@PathVariable String id, @RequestBody Map<String,Object> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(reschedule.apply(TenantContextService.currentTenantId(), id, request, TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/risk-reschedule/preview")
    public ApiResponse<Map<String,Object>> previewRiskBatch(@PathVariable String id, @RequestBody Map<String,Object> request) {
        Map<String,Object> result = riskPreview.preview(TenantContextService.currentTenantId(), id, request);
        result.put("canConfirm", "owner".equalsIgnoreCase(TenantContextService.currentMerchantRole()));
        return ApiResponse.success(result);
    }

    @PostMapping("/plans/{id}/risk-reschedule/apply")
    public ApiResponse<Map<String,Object>> applyRiskBatch(@PathVariable String id, @RequestBody Map<String,Object> request) {
        if (!"owner".equalsIgnoreCase(TenantContextService.currentMerchantRole()))
            throw new com.agri.production.common.exception.BusinessException(403, "仅当前经营主体负责人可确认批量重排");
        return ApiResponse.success(riskPreview.apply(TenantContextService.currentTenantId(), id, request, TenantContextService.currentOperator()));
    }

    @PostMapping("/weather/refresh")
    public ApiResponse<Map<String,Object>> refreshWeather(@RequestBody Map<String,String> request) {
        return ApiResponse.success(weather.refresh(TenantContextService.currentTenantId(), request.get("farmId")));
    }

    @PostMapping("/plans/{id}/weather/verify")
    public ApiResponse<Map<String,Object>> verifyWeather(@PathVariable String id) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.verifyWeather(TenantContextService.currentTenantId(), id, TenantContextService.currentOperator()));
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(@RequestParam String farmId) {
        return ApiResponse.success(service.overview(TenantContextService.currentTenantId(), farmId));
    }

    @PostMapping("/plans/solve")
    public ApiResponse<Map<String, Object>> solve(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.solve(TenantContextService.currentTenantId(), request, TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/approve")
    public ApiResponse<Map<String, Object>> approve(@PathVariable String id, @RequestBody Map<String, String> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.approve(TenantContextService.currentTenantId(), id, request.getOrDefault("reason", ""), TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/publish")
    public ApiResponse<Map<String, Object>> publish(@PathVariable String id) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.publish(TenantContextService.currentTenantId(), id, TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/dispatches/{dispatchId}/progress")
    public ApiResponse<Map<String, Object>> progress(@PathVariable String id, @PathVariable String dispatchId, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.progress(TenantContextService.currentTenantId(), id, dispatchId, request, TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/dispatches/{dispatchId}/workers/{workerId}/progress")
    public ApiResponse<Map<String, Object>> workerProgress(@PathVariable String id, @PathVariable String dispatchId,
                                                            @PathVariable String workerId, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.workerProgress(TenantContextService.currentTenantId(), id, dispatchId, workerId, request, TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/dispatches/{dispatchId}/machines/{machineId}/progress")
    public ApiResponse<Map<String, Object>> machineProgress(@PathVariable String id, @PathVariable String dispatchId,
                                                             @PathVariable String machineId, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.machineProgress(TenantContextService.currentTenantId(), id, dispatchId, machineId, request, TenantContextService.currentOperator()));
    }
    @PostMapping("/plans/{id}/dispatches/{dispatchId}/machines/{machineId}/faults")
    public ApiResponse<Map<String, Object>> reportMachineFault(@PathVariable String id, @PathVariable String dispatchId,
            @PathVariable String machineId, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.reportMachineFault(TenantContextService.currentTenantId(), id, dispatchId, machineId, request, TenantContextService.currentOperator()));
    }

    @PostMapping("/plans/{id}/dispatches/{dispatchId}/machines/{machineId}/faults/{faultId}/resolve")
    public ApiResponse<Map<String, Object>> resolveMachineFault(@PathVariable String id, @PathVariable String dispatchId,
            @PathVariable String machineId, @PathVariable String faultId, @RequestBody Map<String, Object> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.resolveMachineFault(TenantContextService.currentTenantId(), id, dispatchId, machineId, faultId, request, TenantContextService.currentOperator()));
    }
}
