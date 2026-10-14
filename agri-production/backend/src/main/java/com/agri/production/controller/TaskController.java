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

    /**
     * 任务验收。
     *
     * <p>路径与入参按前端契约（{@code api/tasks.ts} 的
     * {@code GET/POST /tasks/{taskId}/acceptance}，入参 {@code acceptStatus} / {@code remark}）。
     * 原先这里是 {@code POST /{id}/approve} + {@code approvalStatus/approvalComment} ——
     * 名字前端不认，而且那两个字段对应的列在表里根本不存在（写了就是 Unknown column）。</p>
     */
    @PostMapping("/{id}/acceptance")
    public ApiResponse<TaskVO> acceptTask(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        Object status = body.get("acceptStatus");
        Integer acceptStatus = status == null ? null : Integer.valueOf(String.valueOf(status));
        String remark = body.get("remark") == null ? null : String.valueOf(body.get("remark"));
        String acceptorName = body.get("acceptorName") == null ? null : String.valueOf(body.get("acceptorName"));
        TaskVO vo = taskService.acceptTask(id, acceptStatus, remark, acceptorName, tenantId);
        return ApiResponse.success(vo);
    }

    /** 验收视图（前端 TaskAcceptance 页面读它）。 */
    @GetMapping("/{id}/acceptance")
    public ApiResponse<Map<String, Object>> getAcceptance(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(taskService.getAcceptance(id, tenantId));
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
