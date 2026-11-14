package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.InputSafetyService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 投入品建议与安全校验：只产生建议/拦截和审计，不直接领用库存或创建农事任务。 */
@RestController
@RequestMapping("/api/v1/production/input-safety")
public class InputSafetyController {
    private final InputSafetyService service;
    public InputSafetyController(InputSafetyService service) { this.service = service; }
    private String tenant() { return TenantContextService.currentTenantId(); }
    private String operator() { return TenantContextService.currentOperator(); }

    @PostMapping("/check")
    public ApiResponse<Map<String, Object>> check(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.check(tenant(), request, operator()));
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> list(@RequestParam(defaultValue = "1") int pageNum,
                                                  @RequestParam(defaultValue = "10") int pageSize,
                                                  @RequestParam(required = false) String state) {
        return ApiResponse.success(service.list(tenant(), pageNum, pageSize, state));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String id) {
        return ApiResponse.success(service.detail(tenant(), id));
    }

    @PostMapping("/{id}/compare-actual")
    public ApiResponse<Map<String, Object>> compareActual(@PathVariable String id,
                                                           @RequestBody Map<String, Object> actual) {
        return ApiResponse.success(service.compareActual(tenant(), id, actual, operator()));
    }
    @GetMapping("/rules/{kind}")
    public ApiResponse<Object> rules(@PathVariable String kind) { return ApiResponse.success(service.rules(tenant(), kind)); }
    @PostMapping("/rules/{kind}")
    public ApiResponse<Object> saveRule(@PathVariable String kind, @RequestBody Map<String,Object> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.saveRule(tenant(),kind,request,operator()));
    }
    @GetMapping("/risks")
    public ApiResponse<Object> risks() { return ApiResponse.success(service.risks(tenant())); }
    @PostMapping("/risks/{id}/review")
    public ApiResponse<Object> reviewRisk(@PathVariable String id,@RequestBody Map<String,Object> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.reviewRisk(tenant(),id,request,operator()));
    }
}
