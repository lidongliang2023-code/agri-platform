package com.agri.production.controller;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.ITaskService;
import com.agri.production.vo.TaskVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.agri.production.service.TenantContextService;

@RestController
@RequestMapping("/api/v1/production/tasks")
public class TaskController {

    private final ITaskService taskService;

    public TaskController(ITaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    public ApiResponse<TaskVO> create(@Valid @RequestBody TaskSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        TaskVO vo = taskService.save(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @PutMapping("/{id}")
    public ApiResponse<TaskVO> update(@PathVariable Long id, @Valid @RequestBody TaskSaveDTO dto) {
        dto.setId(id);
        String tenantId = TenantContextService.currentTenantId();
        TaskVO vo = taskService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        taskService.delete(id, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskVO> getById(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        TaskVO vo = taskService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{taskCode}")
    public ApiResponse<TaskVO> getByCode(@PathVariable String taskCode) {
        String tenantId = TenantContextService.currentTenantId();
        TaskVO vo = taskService.getByCode(taskCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<TaskVO>> pageQuery(TaskPageDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PageResult<TaskVO> result = taskService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/start")
    public ApiResponse<TaskVO> startTask(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        TaskVO vo = taskService.startTask(id, tenantId);
        return ApiResponse.success(vo);
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<TaskVO> completeTask(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String tenantId = TenantContextService.currentTenantId();
        String resultDesc = body.get("resultDesc");
        String resultPhotoUrls = body.get("resultPhotoUrls");
        TaskVO vo = taskService.completeTask(id, resultDesc, resultPhotoUrls, tenantId);
        return ApiResponse.success(vo);
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<TaskVO> approveTask(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String tenantId = TenantContextService.currentTenantId();
        String approvalStatus = body.get("approvalStatus");
        String approvalComment = body.get("approvalComment");
        TaskVO vo = taskService.approveTask(id, approvalStatus, approvalComment, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/farm/{farmId}")
    public ApiResponse<List<TaskVO>> listByFarmId(@PathVariable Long farmId) {
        String tenantId = TenantContextService.currentTenantId();
        List<TaskVO> list = taskService.listByFarmId(farmId, tenantId);
        return ApiResponse.success(list);
    }

    @GetMapping("/executor/{executorId}")
    public ApiResponse<List<TaskVO>> listByExecutorId(@PathVariable Long executorId) {
        String tenantId = TenantContextService.currentTenantId();
        List<TaskVO> list = taskService.listByExecutorId(executorId, tenantId);
        return ApiResponse.success(list);
    }
}