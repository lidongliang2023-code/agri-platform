package com.agri.common.controller;

import com.agri.common.entity.Tenant;
import com.agri.common.service.ITenantService;
import com.agri.iot.common.ResponseResult;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tenant")
public class TenantController {

    private final ITenantService tenantService;

    public TenantController(ITenantService tenantService) {
        this.tenantService = tenantService;
    }

    @GetMapping("/page")
    public ResponseResult<IPage<Tenant>> page(@RequestParam(defaultValue = "1") Integer pageNum,
                                              @RequestParam(defaultValue = "10") Integer pageSize) {
        Page<Tenant> page = new Page<>(pageNum, pageSize);
        IPage<Tenant> result = tenantService.page(page);
        return ResponseResult.success(result);
    }

    @GetMapping("/{id}")
    public ResponseResult<Tenant> getById(@PathVariable Long id) {
        Tenant tenant = tenantService.getById(id);
        return ResponseResult.success(tenant);
    }

    @GetMapping("/code/{tenantCode}")
    public ResponseResult<Tenant> getByCode(@PathVariable String tenantCode) {
        Tenant tenant = tenantService.getByCode(tenantCode);
        return ResponseResult.success(tenant);
    }

    @PostMapping
    public ResponseResult<Void> save(@RequestBody Tenant tenant) {
        tenantService.saveTenant(tenant);
        return ResponseResult.success();
    }

    @PutMapping
    public ResponseResult<Void> update(@RequestBody Tenant tenant) {
        tenantService.updateTenant(tenant);
        return ResponseResult.success();
    }

    @DeleteMapping("/{id}")
    public ResponseResult<Void> delete(@PathVariable Long id) {
        tenantService.deleteTenant(id);
        return ResponseResult.success();
    }
}