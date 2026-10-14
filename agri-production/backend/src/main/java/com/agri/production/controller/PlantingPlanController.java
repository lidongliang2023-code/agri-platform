package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.dto.PlantingPlanSaveDTO;
import com.agri.production.entity.PlanStage;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.service.IPlanStageService;
import com.agri.production.service.IPlantingPlanService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.PlantingPlanVO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 种养计划（作物/品种/周期/预期产量）与生育期阶段（用户端）。
 *
 * <p>路径与入参按前端契约：{@code api/production-view.ts} 的 BASE 是
 * {@code /api/v1/production} + {@code /plans}。此前这个控制器挂在
 * {@code /api/production/plan} 下（少 {@code v1}、多 {@code production}），
 * 且只有 page/list/{id} 等几个端点 —— 前端真正调用的
 * {@code /start}、{@code /terminate}、{@code /{id}/stages/list}、{@code /calendar}
 * 一个都不存在，页面上的"启动/终止/阶段/日历"必然点不动。</p>
 *
 * <p>分页参数同时接受 {@code page/size} 与 {@code pageNum/pageSize}：前端
 * {@code buildPageParams} 两套一起下发，是为了兼容两种后端实现（core-platform 用前者）。
 * 只认其中一套时，另一套调用方会看到"总数对、页码恒为 1"这类静默错误。</p>
 */
@RestController
@RequestMapping("/api/v1/production/plans")
public class PlantingPlanController {

    private final IPlantingPlanService plantingPlanService;
    private final IPlanStageService planStageService;

    public PlantingPlanController(IPlantingPlanService plantingPlanService,
                                  IPlanStageService planStageService) {
        this.plantingPlanService = plantingPlanService;
        this.planStageService = planStageService;
    }

    /** 分页查询计划列表。 */
    @GetMapping
    public ApiResponse<PageResult<PlantingPlanVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String planName,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String planStatus,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) Integer planYear) {
        String tenantId = TenantContextService.currentTenantId();
        int current = firstNonNull(pageNum, page, 1);
        int limit = firstNonNull(pageSize, size, 10);
        PageResult<PlantingPlanVO> result = plantingPlanService.pageByContract(
                current, limit,
                keyword != null ? keyword : planName,
                status, planStatus,
                parseLong(farmId), planYear, tenantId);
        return ApiResponse.success(result);
    }

    /**
     * 计划日历（按计划开始月份聚合数量与面积）。
     *
     * <p>必须排在 {@code /{id}} 之前语义上才不歧义 —— Spring 会优先匹配字面量路径，
     * 所以 {@code /plans/calendar} 不会被 {@code /plans/{id}} 吃掉（{@code {id} 是 Long，
     * 即便被匹配到也只会 400）。这里显式写下来，免得后人调整顺序时踩坑。</p>
     */
    @GetMapping("/calendar")
    public ApiResponse<List<Map<String, Object>>> calendar() {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(plantingPlanService.calendar(tenantId));
    }

    /** 计划详情。 */
    @GetMapping("/{id}")
    public ApiResponse<PlantingPlanVO> detail(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(plantingPlanService.detail(id, tenantId));
    }

    /** 新增计划，返回新计划的 ID。 */
    @PostMapping
    public ApiResponse<String> create(@RequestBody PlantingPlanSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PlantingPlan saved = plantingPlanService.createByContract(dto, tenantId);
        return ApiResponse.success(String.valueOf(saved.getId()));
    }

    /** 编辑计划。 */
    @PutMapping("/{id}")
    public ApiResponse<PlantingPlanVO> update(@PathVariable Long id, @RequestBody PlantingPlanSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PlantingPlan saved = plantingPlanService.updateByContract(id, dto, tenantId);
        return ApiResponse.success(PlantingPlanVO.of(saved));
    }

    /** 删除计划（逻辑删除）。 */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        plantingPlanService.deletePlan(id, tenantId);
        return ApiResponse.success();
    }

    /** 启动计划：编制中 → 进行中（页面上的"启动"）。 */
    @PostMapping("/{id}/start")
    public ApiResponse<PlantingPlanVO> start(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        PlantingPlan plan = plantingPlanService.startPlan(id, tenantId);
        return ApiResponse.success(PlantingPlanVO.of(plan));
    }

    /** 终止计划 → 已取消（页面上的"终止"）。 */
    @PostMapping("/{id}/terminate")
    public ApiResponse<PlantingPlanVO> terminate(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        PlantingPlan plan = plantingPlanService.terminatePlan(id, tenantId);
        return ApiResponse.success(PlantingPlanVO.of(plan));
    }

    /**
     * 提交计划审批：编制中 → 待审批。
     *
     * <p>入参走查询串而不是请求体：无体的写操作如果声明成 {@code @RequestBody} 必填，
     * 一调就是"Content-Type ... is not supported"的 500（农事任务页踩过同样的坑）。</p>
     */
    @PostMapping("/{id}/submit")
    public ApiResponse<PlantingPlanVO> submit(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        plantingPlanService.submitPlan(id);
        return ApiResponse.success(plantingPlanService.detail(id, tenantId));
    }

    /** 审批计划（通过 → 进行中）。 */
    @PostMapping("/{id}/approve")
    public ApiResponse<PlantingPlanVO> approve(@PathVariable Long id,
                                              @RequestParam(required = false) String approver,
                                              @RequestParam(required = false) String comment) {
        String tenantId = TenantContextService.currentTenantId();
        if (!plantingPlanService.approvePlan(id, approver, comment)) {
            throw new com.agri.production.common.exception.BusinessException(404, "种养计划不存在：" + id);
        }
        return ApiResponse.success(plantingPlanService.detail(id, tenantId));
    }

    /* ==================== 生育期阶段 ==================== */

    /** 计划的阶段列表（前端详情页读它）。 */
    @GetMapping("/{planId}/stages/list")
    public ApiResponse<List<PlanStage>> listStages(@PathVariable Long planId) {
        String tenantId = TenantContextService.currentTenantId();
        // 先过一遍计划归属：阶段查询本身按租户过滤，但"计划不属于我"时应当直接 404，
        // 而不是返回一个空列表（空列表会被读成"这个计划还没有阶段"）
        plantingPlanService.detail(planId, tenantId);
        return ApiResponse.success(planStageService.listByPlan(planId, tenantId));
    }

    /**
     * 计划的阶段**分页**列表（api 层 listPlanStages 走这条）。
     *
     * <p>路径与上面那条只差一个 {@code /list}，但两条都得有：分页这条是 core-platform 也实现的
     * 同名端点，漏了它，切流后该路径会变成 405（路径在、方法不在），而网关的回退只认 404。</p>
     */
    @GetMapping("/{planId}/stages")
    public ApiResponse<PageResult<PlanStage>> pageStages(
            @PathVariable Long planId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        plantingPlanService.detail(planId, tenantId);
        return ApiResponse.success(planStageService.pageByPlan(planId,
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), keyword, status, tenantId));
    }

    /** 新增阶段，返回新阶段 ID。 */
    @PostMapping("/{planId}/stages")
    public ApiResponse<String> createStage(@PathVariable Long planId, @RequestBody PlanStage stage) {
        String tenantId = TenantContextService.currentTenantId();
        plantingPlanService.detail(planId, tenantId);
        PlanStage saved = planStageService.createStage(planId, stage, tenantId);
        return ApiResponse.success(String.valueOf(saved.getStageId()));
    }

    /** 编辑阶段。 */
    @PutMapping("/{planId}/stages/{stageId}")
    public ApiResponse<PlanStage> updateStage(@PathVariable Long planId,
                                             @PathVariable Long stageId,
                                             @RequestBody PlanStage stage) {
        String tenantId = TenantContextService.currentTenantId();
        plantingPlanService.detail(planId, tenantId);
        return ApiResponse.success(planStageService.updateStage(planId, stageId, stage, tenantId));
    }

    /** 删除阶段（逻辑删除）。 */
    @DeleteMapping("/{planId}/stages/{stageId}")
    public ApiResponse<Void> deleteStage(@PathVariable Long planId, @PathVariable Long stageId) {
        String tenantId = TenantContextService.currentTenantId();
        plantingPlanService.detail(planId, tenantId);
        planStageService.deleteStage(planId, stageId, tenantId);
        return ApiResponse.success();
    }

    /* ==================== 内部工具 ==================== */

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }

    private static Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            // 传了非数字的 farmId（例如前端别处用的业务编码）不是错误，只是这个过滤条件用不上
            return null;
        }
    }
}
