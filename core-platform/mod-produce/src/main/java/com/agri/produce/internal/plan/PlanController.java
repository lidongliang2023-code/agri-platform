package com.agri.produce.internal.plan;

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
 * 种养计划与阶段（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanInfoService planInfoService;
    private final PlanStageService planStageService;

    @GetMapping
    public ApiResponse<PageResult<PlanInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(planInfoService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<PlanInfoEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(planInfoService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody PlanInfoEntity entity) {
        return ApiResponse.ok(planInfoService.create(entity).getPlanId());
    }

    @PutMapping("/{id}")
    public ApiResponse<PlanInfoEntity> update(@PathVariable String id, @RequestBody PlanInfoEntity entity) {
        return ApiResponse.ok(planInfoService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        planInfoService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{planId}/stages")
    public ApiResponse<PageResult<PlanStageEntity>> pagePlanStage(@RequestParam(defaultValue = "1") long page,
                                                                  @RequestParam(defaultValue = "10") long size,
                                                                  @RequestParam(required = false) String keyword,
                                                                  @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(planStageService.page(page, size, keyword, status));
    }

    @GetMapping("/{planId}/stages/{id}")
    public ApiResponse<PlanStageEntity> detailPlanStage(@PathVariable String id) {
        return ApiResponse.ok(planStageService.detail(id));
    }

    @PostMapping("/{planId}/stages")
    public ApiResponse<String> createPlanStage(@RequestBody PlanStageEntity entity) {
        return ApiResponse.ok(planStageService.create(entity).getStageId());
    }

    @PutMapping("/{planId}/stages/{id}")
    public ApiResponse<PlanStageEntity> updatePlanStage(@PathVariable String id, @RequestBody PlanStageEntity entity) {
        return ApiResponse.ok(planStageService.update(id, entity));
    }

    @DeleteMapping("/{planId}/stages/{id}")
    public ApiResponse<Void> deletePlanStage(@PathVariable String id) {
        planStageService.delete(id);
        return ApiResponse.ok();
    }

    /** 启动计划 */
    @PostMapping("/{planId}/start")
    public ApiResponse<PlanInfoEntity> start(@PathVariable String planId) {
        return ApiResponse.ok(planInfoService.start(planId));
    }

    /** 终止计划 */
    @PostMapping("/{planId}/terminate")
    public ApiResponse<PlanInfoEntity> terminate(@PathVariable String planId) {
        return ApiResponse.ok(planInfoService.terminate(planId));
    }

    /** 计划阶段列表 */
    @GetMapping("/{planId}/stages/list")
    public ApiResponse<List<PlanStageEntity>> stages(@PathVariable String planId) {
        return ApiResponse.ok(planStageService.listByPlan(planId));
    }

    /** 计划日历（按起始月份聚合） */
    @GetMapping("/calendar")
    public ApiResponse<List<Map<String, Object>>> calendar() {
        return ApiResponse.ok(planInfoService.calendar());
    }

    /** 提交计划（草稿 → 进行中） */
    @PostMapping("/{planId}/submit")
    public ApiResponse<PlanInfoEntity> submit(@PathVariable String planId) {
        return ApiResponse.ok(planInfoService.start(planId));
    }
}
