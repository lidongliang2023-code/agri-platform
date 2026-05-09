package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.TaskTemplate;
import com.agri.production.service.ITaskTemplateService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/production/template")
@RequiredArgsConstructor
public class TaskTemplateController {

    private final ITaskTemplateService taskTemplateService;

    @GetMapping("/page")
    public ApiResponse<IPage<TaskTemplate>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String templateName,
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String cropCategory,
            @RequestParam(required = false) String taskType) {
        Page<TaskTemplate> page = new Page<>(pageNum, pageSize);
        IPage<TaskTemplate> result = taskTemplateService.queryPage(page, templateName, templateType, cropCategory, taskType);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<TaskTemplate>> getList(
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String cropCategory,
            @RequestParam(required = false) String taskType) {
        List<TaskTemplate> templates;
        if (templateType != null && !templateType.isEmpty()) {
            templates = taskTemplateService.getTemplatesByType(templateType);
        } else if (cropCategory != null && !cropCategory.isEmpty()) {
            templates = taskTemplateService.getTemplatesByCrop(cropCategory);
        } else if (taskType != null && !taskType.isEmpty()) {
            templates = taskTemplateService.getTemplatesByTaskType(taskType);
        } else {
            templates = taskTemplateService.list();
        }
        return ApiResponse.success(templates);
    }

    @GetMapping("/system")
    public ApiResponse<List<TaskTemplate>> getSystemTemplates() {
        List<TaskTemplate> templates = taskTemplateService.getSystemTemplates();
        return ApiResponse.success(templates);
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskTemplate> getById(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null) {
            return ApiResponse.error("任务模板不存在");
        }
        return ApiResponse.success(template);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody TaskTemplate template) {
        template.setDelFlag(0);
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());
        template.setStatus("active");
        template.setIsSystem(0);
        boolean success = taskTemplateService.save(template);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody TaskTemplate template) {
        TaskTemplate existing = taskTemplateService.getById(id);
        if (existing == null) {
            return ApiResponse.error("任务模板不存在");
        }
        template.setId(id);
        template.setUpdateTime(new Date());
        boolean success = taskTemplateService.updateById(template);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null) {
            return ApiResponse.error("任务模板不存在");
        }
        template.setDelFlag(1);
        template.setUpdateTime(new Date());
        boolean success = taskTemplateService.updateById(template);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        boolean success = taskTemplateService.updateTemplateStatus(id, status);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新状态失败");
    }

    @PostMapping("/{id}/use")
    public ApiResponse<Boolean> incrementUseCount(@PathVariable Long id) {
        taskTemplateService.incrementUseCount(id);
        return ApiResponse.success(true);
    }
}