package com.agri.production.service;

import com.agri.production.entity.PlanStage;
import com.agri.production.common.entity.PageResult;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

/**
 * 种养计划阶段（生育期）。
 *
 * <p>所有方法都带 tenantId：阶段没有独立的租户字段来源，必须由调用方（控制器）
 * 从 {@link TenantContextService} 解析后传进来，避免出现"忘记按租户过滤"的入口。</p>
 */
public interface IPlanStageService extends IService<PlanStage> {

    /** 计划的阶段列表（按序号升序）。 */
    List<PlanStage> listByPlan(Long planId, String tenantId);

    /**
     * 计划的阶段**分页**列表（前端 {@code GET /plans/{planId}/stages}）。
     *
     * <p>与 {@link #listByPlan} 并存不是重复：页面用的是不分页的那个（{@code /stages/list}），
     * 而 api 层另有一个走分页的 {@code listPlanStages}。少了这个端点，网关切流后该路径会
     * 命中"路径存在但方法不对"的 405（实测），而 405 不在回退规则里。</p>
     */
    PageResult<PlanStage> pageByPlan(Long planId, int pageNum, int pageSize, String keyword, Integer status, String tenantId);

    /** 新增阶段（序号缺省时取当前最大值 +1）。 */
    PlanStage createStage(Long planId, PlanStage stage, String tenantId);

    /** 更新阶段（以路径上的 stageId 为准，不接受请求体改 ID）。 */
    PlanStage updateStage(Long planId, Long stageId, PlanStage stage, String tenantId);

    /** 逻辑删除阶段。 */
    void deleteStage(Long planId, Long stageId, String tenantId);
}
