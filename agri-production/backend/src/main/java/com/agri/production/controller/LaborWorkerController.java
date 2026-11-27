package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.LaborWorkerService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 采收域劳务人员库接口。 */
@RestController
@RequestMapping("/api/v1/production/labor-workers")
public class LaborWorkerController {
    private final LaborWorkerService service;

    public LaborWorkerController(LaborWorkerService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResult<Map<String, Object>>> page(
            @RequestParam String farmId,
            @RequestParam(required = false, defaultValue = "1") Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false, defaultValue = "20") Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String skillType,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(service.page(
                TenantContextService.currentTenantId(), farmId,
                first(pageNum, page), first(pageSize, size), keyword, sourceType, skillType, status));
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary(@RequestParam String farmId,
                                                    @RequestParam(required = false) String date) {
        return ApiResponse.success(service.summary(TenantContextService.currentTenantId(), farmId, date));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String id) {
        return ApiResponse.success(service.detail(TenantContextService.currentTenantId(), id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody Map<String, Object> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.create(TenantContextService.currentTenantId(), request,
                TenantContextService.currentOperator()));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable String id,
                                                   @RequestBody Map<String, Object> request) {
        TenantContextService.requireSubjectOwner();
        return ApiResponse.success(service.update(TenantContextService.currentTenantId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        TenantContextService.requireSubjectOwner();
        service.delete(TenantContextService.currentTenantId(), id);
        return ApiResponse.success();
    }

    private static int first(Integer primary, Integer fallback) {
        return primary != null ? primary : (fallback == null ? 1 : fallback);
    }
}
