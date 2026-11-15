package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.ProcessOptimizationService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 产后初加工工艺优化：建议、确认、下发记录、纠偏与结果回写。 */
@RestController
@RequestMapping("/api/v1/production/process-optimizations")
public class ProcessOptimizationController {
    private final ProcessOptimizationService service;
    public ProcessOptimizationController(ProcessOptimizationService service) { this.service = service; }
    private String tenant() { return TenantContextService.currentTenantId(); }
    private String operator() { return TenantContextService.currentOperator(); }

    @GetMapping
    public ApiResponse<Object> list(@RequestParam(defaultValue="1") int pageNum,
                                    @RequestParam(defaultValue="20") int pageSize,
                                    @RequestParam(required=false) String status) {
        return ApiResponse.success(service.list(tenant(), pageNum, pageSize, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<Object> detail(@PathVariable String id) { return ApiResponse.success(service.detail(tenant(), id)); }

    @PostMapping("/infer")
    public ApiResponse<Object> infer(@RequestBody Map<String,Object> request) { return ApiResponse.success(service.infer(tenant(), request, operator())); }

    @PostMapping("/{id}/confirm")
    public ApiResponse<Object> confirm(@PathVariable String id, @RequestBody Map<String,Object> request) { return ApiResponse.success(service.confirm(tenant(), id, request, operator())); }

    @PostMapping("/{id}/dispatch")
    public ApiResponse<Object> dispatch(@PathVariable String id) { return ApiResponse.success(service.dispatch(tenant(), id, operator())); }

    @PostMapping("/{id}/deviations")
    public ApiResponse<Object> deviation(@PathVariable String id, @RequestBody Map<String,Object> request) { return ApiResponse.success(service.deviation(tenant(), id, request, operator())); }

    @PostMapping("/{id}/result")
    public ApiResponse<Object> result(@PathVariable String id, @RequestBody Map<String,Object> request) { return ApiResponse.success(service.result(tenant(), id, request, operator())); }
}
