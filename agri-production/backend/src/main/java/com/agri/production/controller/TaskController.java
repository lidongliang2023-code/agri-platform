package com.agri.production.controller;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.ITaskService;
import com.agri.production.service.FarmIdResolver;
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
    private final FarmIdResolver farmIdResolver;

    public TaskController(ITaskService taskService, FarmIdResolver farmIdResolver) {
        this.taskService = taskService;
        this.farmIdResolver = farmIdResolver;
    }

    @PostMapping
    public ApiResponse<String> create(@Valid @RequestBody TaskSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        TaskVO vo = taskService.save(dto, tenantId);
        // 契约是**返回新任务 id 字符串**（前端 api 的 createTask 声明就是 Promise<string>，
        // 页面拿它跳 /production/tasks/{id}）。此前返回实体对象，页面虽然写了兼容分支
        // （typeof raw === 'string' ? raw : raw?.taskId）没炸，但契约本身是错的 ——
        // 与农场 / 计划那两处统一（它们各自踩过一次 `[object Object]`）。
        return ApiResponse.success(vo.getId() == null ? null : String.valueOf(vo.getId()));
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
    public ApiResponse<PageResult<TaskVO>> pageQuery(TaskPageDTO dto,
                                                     @RequestParam(required = false) String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        // farmId 走解析：页面传的是平台侧农场标识（DEMO-FARM-xxx）。
        // 原先 DTO 里是 Long，Spring 在绑定时就抛「参数类型不匹配: farmId」——
        // 用户只看到"400"，既不知道是自己传错了、也不知道该传本服务的数字 id。
        PageResult<TaskVO> result = taskService.pageQuery(dto, farmIdResolver.resolveFilter(farmId, tenantId), tenantId);
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
        // 注意：这里**不能**写成 `pass == null ? acceptStatus : (Boolean.TRUE.equals(pass) ? 1 : 2)`。
        // 三元表达式两支一个 Integer、一个 int，Java 会做二进制数值提升，把整个表达式的类型判成 int ——
        // 于是 acceptStatus 为 null 时那一支会被**拆箱**，直接 NPE。实测：
        // POST /tasks/1/acceptance 不带参数 → 500「Cannot invoke "java.lang.Integer.intValue()"
        // because "acceptStatus" is null」。写成 if/else 就没有这层提升。
        Integer finalStatus;
        if (Boolean.TRUE.equals(pass)) {
            finalStatus = 1;
        } else if (Boolean.FALSE.equals(pass)) {
            finalStatus = 2;
        } else {
            finalStatus = acceptStatus;
        }
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
    public ApiResponse<List<TaskVO>> listByFarmId(@PathVariable String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        List<TaskVO> list = taskService.listByFarmId(farmIdResolver.resolveFilter(farmId, tenantId), tenantId);
        return ApiResponse.success(list);
    }

    @GetMapping("/executor/{executorId}")
    public ApiResponse<List<TaskVO>> listByExecutorId(@PathVariable Long executorId) {
        String tenantId = TenantContextService.currentTenantId();
        List<TaskVO> list = taskService.listByExecutorId(executorId, tenantId);
        return ApiResponse.success(list);
    }
}
