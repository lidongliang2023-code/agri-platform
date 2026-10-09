package com.agri.produce.internal.task;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 农事任务与执行记录（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskInfoService taskInfoService;
    private final TaskRecordService taskRecordService;
    private final TaskTemplateService taskTemplateService;

    @GetMapping
    public ApiResponse<PageResult<TaskInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) String status) {
        return ApiResponse.ok(taskInfoService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskInfoEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(taskInfoService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody TaskInfoEntity entity) {
        return ApiResponse.ok(taskInfoService.create(entity).getTaskId());
    }

    @PutMapping("/{id}")
    public ApiResponse<TaskInfoEntity> update(@PathVariable String id, @RequestBody TaskInfoEntity entity) {
        return ApiResponse.ok(taskInfoService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        taskInfoService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{taskId}/records")
    public ApiResponse<PageResult<TaskRecordEntity>> pageTaskRecord(@RequestParam(defaultValue = "1") long page,
                                                                    @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(taskRecordService.page(page, size));
    }

    @GetMapping("/{taskId}/records/{id}")
    public ApiResponse<TaskRecordEntity> detailTaskRecord(@PathVariable String id) {
        return ApiResponse.ok(taskRecordService.detail(id));
    }

    @PostMapping("/{taskId}/records")
    public ApiResponse<String> createTaskRecord(@RequestBody TaskRecordEntity entity) {
        return ApiResponse.ok(taskRecordService.create(entity).getRecordId());
    }

    @PutMapping("/{taskId}/records/{id}")
    public ApiResponse<TaskRecordEntity> updateTaskRecord(@PathVariable String id, @RequestBody TaskRecordEntity entity) {
        return ApiResponse.ok(taskRecordService.update(id, entity));
    }

    @DeleteMapping("/{taskId}/records/{id}")
    public ApiResponse<Void> deleteTaskRecord(@PathVariable String id) {
        taskRecordService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/templates")
    public ApiResponse<PageResult<TaskTemplateEntity>> pageTaskTemplate(@RequestParam(defaultValue = "1") long page,
                                                                        @RequestParam(defaultValue = "10") long size,
                                                                        @RequestParam(required = false) String keyword,
                                                                        @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(taskTemplateService.page(page, size, keyword, status));
    }

    @GetMapping("/templates/{id}")
    public ApiResponse<TaskTemplateEntity> detailTaskTemplate(@PathVariable String id) {
        return ApiResponse.ok(taskTemplateService.detail(id));
    }

    @PostMapping("/templates")
    public ApiResponse<String> createTaskTemplate(@RequestBody TaskTemplateEntity entity) {
        return ApiResponse.ok(taskTemplateService.create(entity).getTemplateId());
    }

    @PutMapping("/templates/{id}")
    public ApiResponse<TaskTemplateEntity> updateTaskTemplate(@PathVariable String id, @RequestBody TaskTemplateEntity entity) {
        return ApiResponse.ok(taskTemplateService.update(id, entity));
    }

    @DeleteMapping("/templates/{id}")
    public ApiResponse<Void> deleteTaskTemplate(@PathVariable String id) {
        taskTemplateService.delete(id);
        return ApiResponse.ok();
    }

    /** 派发任务 */
    @PostMapping("/{taskId}/assign")
    public ApiResponse<TaskInfoEntity> assign(@PathVariable String taskId,
                                              @RequestParam String assigneeId) {
        return ApiResponse.ok(taskInfoService.assign(taskId, assigneeId));
    }

    /** 开始执行 */
    @PostMapping("/{taskId}/start")
    public ApiResponse<TaskInfoEntity> start(@PathVariable String taskId) {
        return ApiResponse.ok(taskInfoService.start(taskId));
    }

    /** 任务验收：pass=true 通过，false 驳回 */
    @PostMapping("/{taskId}/accept")
    public ApiResponse<TaskInfoEntity> accept(@PathVariable String taskId,
                                              @RequestParam(defaultValue = "true") boolean pass,
                                              @RequestParam(required = false) String opinion) {
        return ApiResponse.ok(taskInfoService.accept(taskId, pass, opinion));
    }

    /** 我的待办 */
    @GetMapping("/todo")
    public ApiResponse<List<TaskInfoEntity>> todo(@RequestParam String assigneeId) {
        return ApiResponse.ok(taskInfoService.listByAssignee(assigneeId));
    }

    /** 按作物查模板 */
    @GetMapping("/templates/by-crop")
    public ApiResponse<List<TaskTemplateEntity>> templatesByCrop(@RequestParam String cropId) {
        return ApiResponse.ok(taskTemplateService.listByCrop(cropId));
    }

    /** 提交验收（执行完成 → 待验收） */
    @PostMapping("/{taskId}/submit")
    public ApiResponse<TaskInfoEntity> submit(@PathVariable String taskId) {
        return ApiResponse.ok(taskInfoService.submit(taskId));
    }

    /** 验收（/accept 的别名） */
    @PostMapping("/{taskId}/acceptance")
    public ApiResponse<TaskInfoEntity> acceptance(@PathVariable String taskId,
                                                  @RequestParam(defaultValue = "true") boolean pass,
                                                  @RequestParam(required = false) String opinion) {
        return ApiResponse.ok(taskInfoService.accept(taskId, pass, opinion));
    }
}
