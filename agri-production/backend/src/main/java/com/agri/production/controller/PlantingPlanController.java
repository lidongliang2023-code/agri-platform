package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.service.IPlantingPlanService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/production/plan")
@RequiredArgsConstructor
public class PlantingPlanController {

    private final IPlantingPlanService plantingPlanService;

    @GetMapping("/page")
    public ApiResponse<IPage<PlantingPlan>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String planName,
            @RequestParam(required = false) Integer planYear,
            @RequestParam(required = false) String planStatus) {
        Page<PlantingPlan> page = new Page<>(pageNum, pageSize);
        IPage<PlantingPlan> result = plantingPlanService.queryPage(page, farmId, planName, planYear, planStatus);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<PlantingPlan>> getList(
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) Integer planYear,
            @RequestParam(required = false) String planStatus) {
        List<PlantingPlan> plans;
        if (farmId != null) {
            plans = plantingPlanService.getPlansByFarmId(farmId);
        } else if (planYear != null) {
            plans = plantingPlanService.getPlansByYear(planYear);
        } else if (planStatus != null && !planStatus.isEmpty()) {
            plans = plantingPlanService.getPlansByStatus(planStatus);
        } else {
            plans = plantingPlanService.list();
        }
        return ApiResponse.success(plans);
    }

    @GetMapping("/{id}")
    public ApiResponse<PlantingPlan> getById(@PathVariable Long id) {
        PlantingPlan plan = plantingPlanService.getById(id);
        if (plan == null) {
            return ApiResponse.error("种植计划不存在");
        }
        return ApiResponse.success(plan);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody PlantingPlan plan) {
        plan.setDelFlag(0);
        plan.setCreateTime(new Date());
        plan.setUpdateTime(new Date());
        plan.setPlanStatus("draft");
        boolean success = plantingPlanService.save(plan);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody PlantingPlan plan) {
        PlantingPlan existing = plantingPlanService.getById(id);
        if (existing == null) {
            return ApiResponse.error("种植计划不存在");
        }
        plan.setId(id);
        plan.setUpdateTime(new Date());
        boolean success = plantingPlanService.updateById(plan);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        PlantingPlan plan = plantingPlanService.getById(id);
        if (plan == null) {
            return ApiResponse.error("种植计划不存在");
        }
        plan.setDelFlag(1);
        plan.setUpdateTime(new Date());
        boolean success = plantingPlanService.updateById(plan);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<Boolean> submit(@PathVariable Long id) {
        boolean success = plantingPlanService.submitPlan(id);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("提交失败");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<Boolean> approve(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String approver = params.get("approver");
        String comment = params.get("comment");
        boolean success = plantingPlanService.approvePlan(id, approver, comment);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("审批失败");
    }
}