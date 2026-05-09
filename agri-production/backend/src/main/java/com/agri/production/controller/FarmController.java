package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.Farm;
import com.agri.production.service.IFarmService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/production/farm")
@RequiredArgsConstructor
public class FarmController {

    private final IFarmService farmService;

    @GetMapping("/page")
    public ApiResponse<IPage<Farm>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String farmName,
            @RequestParam(required = false) String farmType,
            @RequestParam(required = false) String auditStatus) {
        Page<Farm> page = new Page<>(pageNum, pageSize);
        IPage<Farm> result = farmService.queryPage(page, farmName, farmType, auditStatus);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<Farm>> getList(
            @RequestParam(required = false) String farmType,
            @RequestParam(required = false) String auditStatus) {
        List<Farm> farms;
        if (farmType != null && !farmType.isEmpty()) {
            farms = farmService.getFarmsByType(farmType);
        } else if (auditStatus != null && !auditStatus.isEmpty()) {
            farms = farmService.getFarmsByAuditStatus(auditStatus);
        } else {
            farms = farmService.getActiveFarms();
        }
        return ApiResponse.success(farms);
    }

    @GetMapping("/{id}")
    public ApiResponse<Farm> getById(@PathVariable Long id) {
        Farm farm = farmService.getById(id);
        if (farm == null) {
            return ApiResponse.error("农场不存在");
        }
        return ApiResponse.success(farm);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody Farm farm) {
        farm.setDelFlag(0);
        farm.setCreateTime(new Date());
        farm.setUpdateTime(new Date());
        farm.setAuditStatus("pending");
        farm.setStatus("inactive");
        boolean success = farmService.save(farm);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody Farm farm) {
        Farm existing = farmService.getById(id);
        if (existing == null) {
            return ApiResponse.error("农场不存在");
        }
        farm.setId(id);
        farm.setUpdateTime(new Date());
        boolean success = farmService.updateById(farm);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        Farm farm = farmService.getById(id);
        if (farm == null) {
            return ApiResponse.error("农场不存在");
        }
        farm.setDelFlag(1);
        farm.setUpdateTime(new Date());
        boolean success = farmService.updateById(farm);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/audit")
    public ApiResponse<Boolean> audit(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String auditStatus = params.get("auditStatus");
        String auditComment = params.get("auditComment");
        String auditor = params.get("auditor");
        boolean success = farmService.auditFarm(id, auditStatus, auditComment, auditor);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("审核失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        boolean success = farmService.updateFarmStatus(id, status);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新状态失败");
    }
}