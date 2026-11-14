package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.InputRegistrationSyncService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 官方农药登记信息同步：只生成草稿规则，不自动启用。 */
@RestController
@RequestMapping("/api/v1/production/input-safety/registration-sync")
public class InputRegistrationSyncController {
    private final InputRegistrationSyncService service;
    public InputRegistrationSyncController(InputRegistrationSyncService service) { this.service = service; }

    @GetMapping("/config")
    public ApiResponse<Map<String, Object>> config() { return ApiResponse.success(service.config()); }

    @GetMapping("/batches")
    public ApiResponse<List<Map<String, Object>>> batches() { return ApiResponse.success(service.batches(TenantContextService.currentTenantId())); }

    @PostMapping
    public ApiResponse<Map<String, Object>> sync(@RequestBody(required = false) Map<String, Object> body) {
        TenantContextService.requireSubjectOwner();
        String url = body == null ? null : body.get("sourceUrl") == null ? null : String.valueOf(body.get("sourceUrl"));
        return ApiResponse.success(service.sync(TenantContextService.currentTenantId(), url, TenantContextService.currentOperator()));
    }
}
