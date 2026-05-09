package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.Task;
import com.agri.production.service.ITaskService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/production/task")
@RequiredArgsConstructor
public class TaskController {

    private final ITaskService taskService;

    @GetMapping("/page")
    public ApiResponse<IPage<Task>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String taskName,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String executor) {
        Page<Task> page = new Page<>(pageNum, pageSize);
        IPage<Task> result = taskService.queryPage(page, farmId, taskName, taskType, status, executor);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<Task>> getList(
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String taskType) {
        List<Task> tasks;
        if (farmId != null) {
            tasks = taskService.getTasksByFarmId(farmId);
        } else if (status != null && !status.isEmpty()) {
            tasks = taskService.getTasksByStatus(status);
        } else if (taskType != null && !taskType.isEmpty()) {
            tasks = taskService.getTasksByType(taskType);
        } else {
            tasks = taskService.list();
        }
        return ApiResponse.success(tasks);
    }

    @GetMapping("/{id}")
    public ApiResponse<Task> getById(@PathVariable Long id) {
        Task task = taskService.getById(id);
        if (task == null) {
            return ApiResponse.error("任务不存在");
        }
        return ApiResponse.success(task);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody Task task) {
        task.setDelFlag(0);
        task.setCreateTime(new Date());
        task.setUpdateTime(new Date());
        task.setStatus("pending");
        boolean success = taskService.save(task);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody Task task) {
        Task existing = taskService.getById(id);
        if (existing == null) {
            return ApiResponse.error("任务不存在");
        }
        task.setId(id);
        task.setUpdateTime(new Date());
        boolean success = taskService.updateById(task);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        Task task = taskService.getById(id);
        if (task == null) {
            return ApiResponse.error("任务不存在");
        }
        task.setDelFlag(1);
        task.setUpdateTime(new Date());
        boolean success = taskService.updateById(task);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        boolean success = taskService.updateTaskStatus(id, status);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新状态失败");
    }

    @PostMapping("/{id}/progress")
    public ApiResponse<Boolean> updateProgress(@PathVariable Long id, @RequestBody Map<String, Double> params) {
        Double completionRate = params.get("completionRate");
        boolean success = taskService.updateTaskProgress(id, completionRate);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新进度失败");
    }
}