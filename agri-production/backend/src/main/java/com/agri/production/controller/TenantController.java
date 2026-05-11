package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.Tenant;
import com.agri.production.service.ITenantService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/admin/tenants")
public class TenantController {

    private final ITenantService tenantService;

    public TenantController(ITenantService tenantService) {
        this.tenantService = tenantService;
    }

    @GetMapping
    public ApiResponse<List<Tenant>> list() {
        List<Tenant> tenants = tenantService.listAll();
        return ApiResponse.success(tenants);
    }

    @GetMapping("/{id}")
    public ApiResponse<Tenant> get(@PathVariable Long id) {
        Tenant tenant = tenantService.getById(id);
        if (tenant != null) {
            return ApiResponse.success(tenant);
        }
        return ApiResponse.error("租户不存在");
    }

    @PostMapping
    public ApiResponse<Tenant> create(@RequestBody Tenant tenant) {
        Tenant created = tenantService.create(tenant);
        return ApiResponse.success(created);
    }

    @PutMapping("/{id}")
    public ApiResponse<Tenant> update(@PathVariable Long id, @RequestBody Tenant tenant) {
        Tenant updated = tenantService.update(id, tenant);
        return ApiResponse.success(updated);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        tenantService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Tenant> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String status = request.get("status");
        Tenant updated = tenantService.updateStatus(id, status);
        return ApiResponse.success(updated);
    }

    @PutMapping("/{id}/audit")
    public ApiResponse<Tenant> audit(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String auditStatus = request.get("auditStatus");
        String auditComment = request.get("auditComment");
        Tenant updated = tenantService.audit(id, auditStatus, auditComment);
        return ApiResponse.success(updated);
    }

    @GetMapping("/statistics")
    public ApiResponse<Map<String, Object>> statistics() {
        Map<String, Object> result = new HashMap<>();
        result.put("total", tenantService.countByStatus("active") + tenantService.countByStatus("inactive"));
        result.put("active", tenantService.countByStatus("active"));
        result.put("inactive", tenantService.countByStatus("inactive"));
        return ApiResponse.success(result);
    }
}
