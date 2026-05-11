package com.agri.production.controller;

import com.agri.production.entity.SopExecution;
import com.agri.production.entity.SopTemplate;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.ISopService;
import org.springframework.web.bind.annotation.*;

import com.agri.production.common.entity.PageResult;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/sop")
public class SopController {

    private final ISopService sopService;

    public SopController(ISopService sopService) {
        this.sopService = sopService;
    }

    @GetMapping("/templates")
    public ApiResponse<PageResult<?>> listTemplates(
            @RequestParam(required = false) String templateName,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String taskType,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return ApiResponse.success(sopService.listTemplates(templateName, category, taskType, pageNum, pageSize, "T001"));
    }

    @GetMapping("/templates/{id}")
    public ApiResponse<SopTemplate> getTemplate(@PathVariable Long id) {
        SopTemplate template = sopService.getTemplateById(id);
        return ApiResponse.success(template);
    }

    @PostMapping("/templates")
    public ApiResponse<SopTemplate> saveTemplate(@RequestBody SopTemplate template) {
        SopTemplate saved = sopService.saveTemplate(template, "T001");
        return ApiResponse.success(saved);
    }

    @PutMapping("/templates/{id}")
    public ApiResponse<SopTemplate> updateTemplate(@PathVariable Long id, @RequestBody SopTemplate template) {
        template.setId(id);
        SopTemplate saved = sopService.saveTemplate(template, "T001");
        return ApiResponse.success(saved);
    }

    @DeleteMapping("/templates/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable Long id) {
        sopService.deleteTemplate(id);
        return ApiResponse.success();
    }

    @PostMapping("/templates/{id}/enable")
    public ApiResponse<Void> enableTemplate(@PathVariable Long id, @RequestParam boolean enable) {
        sopService.enableTemplate(id, enable);
        return ApiResponse.success();
    }

    @GetMapping("/templates/by-task-type")
    public ApiResponse<List<SopTemplate>> getTemplatesByTaskType(@RequestParam String taskType) {
        List<SopTemplate> templates = sopService.getTemplatesByTaskType(taskType, "T001");
        return ApiResponse.success(templates);
    }

    @PostMapping("/executions")
    public ApiResponse<SopExecution> startExecution(
            @RequestParam Long templateId,
            @RequestParam(required = false) Long taskId,
            @RequestParam String executor) {
        SopExecution execution = sopService.startExecution(templateId, taskId, executor, "T001");
        return ApiResponse.success(execution);
    }

    @GetMapping("/executions")
    public ApiResponse<PageResult<?>> listExecutions(
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return ApiResponse.success(sopService.listExecutions(templateId, taskId, status, pageNum, pageSize, "T001"));
    }

    @GetMapping("/executions/{id}")
    public ApiResponse<SopExecution> getExecution(@PathVariable Long id) {
        SopExecution execution = sopService.getExecutionById(id);
        return ApiResponse.success(execution);
    }

    @PostMapping("/executions/{id}/complete-step")
    public ApiResponse<Void> completeStep(
            @PathVariable Long id,
            @RequestParam Integer stepIndex,
            @RequestParam(required = false) String record,
            @RequestParam(required = false) String attachment) {
        sopService.completeStep(id, stepIndex, record, attachment);
        return ApiResponse.success();
    }

    @PostMapping("/executions/{id}/complete")
    public ApiResponse<Void> completeExecution(@PathVariable Long id) {
        sopService.completeExecution(id);
        return ApiResponse.success();
    }

    @PostMapping("/executions/{id}/cancel")
    public ApiResponse<Void> cancelExecution(@PathVariable Long id) {
        sopService.cancelExecution(id);
        return ApiResponse.success();
    }
}