package com.agri.admin.controller;

import com.agri.admin.dto.QualityRuleSaveDTO;
import com.agri.admin.dto.QualityTaskSaveDTO;
import com.agri.admin.service.IAdminQualityRuleService;
import com.agri.admin.vo.QualityRuleVO;
import com.agri.admin.vo.QualityTaskVO;
import com.agri.common.entity.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 质量规则与检测任务。
 *
 * <p>与 {@link AdminQualityController} 同属 /admin/masterdata/quality 前缀，
 * 但按配置侧（规则、任务）与运行侧（问题、处置、统计）分开成两个控制器。</p>
 */
@Tag(name = "数据质量 - 规则与任务")
@RestController
@RequestMapping("/admin/masterdata/quality")
@RequiredArgsConstructor
public class AdminQualityRuleController {

    private final IAdminQualityRuleService adminQualityRuleService;

    @Operation(summary = "获取质量规则列表")
    @GetMapping("/rules")
    public ApiResponse<List<QualityRuleVO>> getRuleList(
            @RequestParam(required = false) String ruleType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminQualityRuleService.getRuleList(ruleType, status, keyword));
    }

    @Operation(summary = "创建质量规则")
    @PostMapping("/rules")
    public ApiResponse<Void> createRule(@RequestBody QualityRuleSaveDTO dto) {
        adminQualityRuleService.createRule(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "修改质量规则")
    @PutMapping("/rules/{id}")
    public ApiResponse<Void> updateRule(@PathVariable Long id, @RequestBody QualityRuleSaveDTO dto) {
        adminQualityRuleService.updateRule(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除质量规则")
    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable Long id) {
        adminQualityRuleService.deleteRule(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取检测任务列表")
    @GetMapping("/tasks")
    public ApiResponse<List<QualityTaskVO>> getTaskList(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminQualityRuleService.getTaskList(status, keyword));
    }

    @Operation(summary = "创建检测任务")
    @PostMapping("/tasks")
    public ApiResponse<Void> createTask(@RequestBody QualityTaskSaveDTO dto) {
        adminQualityRuleService.createTask(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "修改检测任务")
    @PutMapping("/tasks/{id}")
    public ApiResponse<Void> updateTask(@PathVariable Long id, @RequestBody QualityTaskSaveDTO dto) {
        adminQualityRuleService.updateTask(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除检测任务")
    @DeleteMapping("/tasks/{id}")
    public ApiResponse<Void> deleteTask(@PathVariable Long id) {
        adminQualityRuleService.deleteTask(id);
        return ApiResponse.success();
    }

    @Operation(summary = "手工触发一次巡检")
    @PostMapping("/tasks/{id}/run")
    public ApiResponse<QualityTaskVO> runTask(@PathVariable Long id) {
        return ApiResponse.success(adminQualityRuleService.runTask(id));
    }
}
