package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.Facility;
import com.agri.production.service.IFacilityService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/production/facility")
@RequiredArgsConstructor
public class FacilityController {

    private final IFacilityService facilityService;

    @GetMapping("/page")
    public ApiResponse<IPage<Facility>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String facilityName,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String status) {
        Page<Facility> page = new Page<>(pageNum, pageSize);
        IPage<Facility> result = facilityService.queryPage(page, farmId, facilityName, facilityType, status);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<Facility>> getList(
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String status) {
        List<Facility> facilities;
        if (farmId != null) {
            facilities = facilityService.getFacilitiesByFarmId(farmId);
        } else if (facilityType != null && !facilityType.isEmpty()) {
            facilities = facilityService.getFacilitiesByType(facilityType);
        } else if (status != null && !status.isEmpty()) {
            facilities = facilityService.getFacilitiesByStatus(status);
        } else {
            facilities = facilityService.list();
        }
        return ApiResponse.success(facilities);
    }

    @GetMapping("/{id}")
    public ApiResponse<Facility> getById(@PathVariable Long id) {
        Facility facility = facilityService.getById(id);
        if (facility == null) {
            return ApiResponse.error("设施不存在");
        }
        return ApiResponse.success(facility);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody Facility facility) {
        facility.setDelFlag(0);
        facility.setCreateTime(new Date());
        facility.setUpdateTime(new Date());
        facility.setStatus("active");
        boolean success = facilityService.save(facility);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody Facility facility) {
        Facility existing = facilityService.getById(id);
        if (existing == null) {
            return ApiResponse.error("设施不存在");
        }
        facility.setId(id);
        facility.setUpdateTime(new Date());
        boolean success = facilityService.updateById(facility);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        Facility facility = facilityService.getById(id);
        if (facility == null) {
            return ApiResponse.error("设施不存在");
        }
        facility.setDelFlag(1);
        facility.setUpdateTime(new Date());
        boolean success = facilityService.updateById(facility);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        boolean success = facilityService.updateFacilityStatus(id, status);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新状态失败");
    }
}