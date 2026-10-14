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

    /**
     * 派发 / 转派任务。
     *
     * <p>前端是 {@code POST /tasks/{id}/assign?assigneeId=xxx}（参数在查询串里，
     * 见 api/tasks.ts 的 dispatchTask）—— 后端此前没有这个接口。</p>
     */
    @PostMapping("/{id}/assign")
    public ApiResponse<TaskVO> assignTask(@PathVariable Long id,
                                          @RequestParam Long assigneeId,
                                          @RequestParam(required = false) String assigneeName) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(taskService.assignTask(id, assigneeId, assigneeName, tenantId));
    }

    /**
     * 提交成果（执行中 → 待验收）。
     *
     * <p>前端契约是 {@code POST /tasks/{id}/submit}（无请求体，见 submitTaskResult）——
     * 后端此前叫 {@code /complete} 且要求 body 必填，前端一调就是 400/404。
     * 保留 /complete 作为别名（同一实现），避免如果还有别处在用旧路径。</p>
     */
    @PostMapping({"/{id}/submit", "/{id}/complete"})
    public ApiResponse<TaskVO> submitTask(@PathVariable Long id,
                                          @RequestParam(required = false) String resultDesc,
                                          @RequestParam(required = false) String resultPhotoUrls) {
        String tenantId = TenantContextService.currentTenantId();
        // 用查询参数而不是 @RequestBody：前端提交成果时不带请求体，
        // 而带 @RequestBody 的方法会拒绝 x-www-form-urlencoded / 无体请求
        // （实测 500：Content-Type 'application/x-www-form-urlencoded' is not supported）。
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
    public ApiResponse<TaskVO> acceptTask(@PathVariable Long id,
                                          @RequestParam(required = false) Boolean pass,
                                          @RequestParam(required = false) String opinion,
                                          @RequestParam(required = false) Integer acceptStatus,
                                          @RequestParam(required = false) String remark,
                                          @RequestParam(required = false) String acceptorName) {
        String tenantId = TenantContextService.currentTenantId();
        // 前端走查询串（pass/opinion，见 api/tasks.ts 的 reviewTask）；
        // 同时认 acceptStatus/remark 两个名字，调用方用哪套都行。
        // 这里不用 @RequestBody：前端不带请求体，带 @RequestBody 会 500（见 submitTask 的说明）。
        Integer finalStatus = pass == null ? acceptStatus : (Boolean.TRUE.equals(pass) ? 1 : 2);
        String finalRemark = remark != null ? remark : opinion;
        TaskVO vo = taskService.acceptTask(id, finalStatus, finalRemark, acceptorName, tenantId);
        return ApiResponse.success(vo);
    }

    /** 任务执行记录（打卡）列表：GET /tasks/{id}/records?page=&size= */
    @GetMapping("/{id}/records")
    public ApiResponse<Map<String, Object>> listRecords(@PathVariable Long id,
                                                        @RequestParam(defaultValue = "1") Integer page,
                                                        @RequestParam(required = false) Integer pageNum,
                                                        @RequestParam(defaultValue = "50") Integer size,
                                                        @RequestParam(required = false) Integer pageSize) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(taskService.pageRecords(id,
                pageNum != null ? pageNum : page,
                pageSize != null ? pageSize : size,
                tenantId));
    }

    /** 新增打卡记录：POST /tasks/{id}/records */
    @PostMapping("/{id}/records")
    public ApiResponse<String> createRecord(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(taskService.createRecord(id, body, tenantId)));
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
