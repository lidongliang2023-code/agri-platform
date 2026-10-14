package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.PlanStage;
import com.agri.production.mapper.PlanStageMapper;
import com.agri.production.service.IPlanStageService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PlanStageServiceImpl extends ServiceImpl<PlanStageMapper, PlanStage> implements IPlanStageService {

    @Override
    public List<PlanStage> listByPlan(Long planId, String tenantId) {
        return this.list(new LambdaQueryWrapper<PlanStage>()
                .eq(PlanStage::getPlanId, planId)
                .eq(PlanStage::getTenantId, tenantId)
                .orderByAsc(PlanStage::getStageSeq)
                .orderByAsc(PlanStage::getStageId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlanStage createStage(Long planId, PlanStage stage, String tenantId) {
        if (stage == null) {
            throw new BusinessException(400, "阶段内容不能为空");
        }
        if (stage.getStageName() == null || stage.getStageName().isBlank()) {
            throw new BusinessException(400, "阶段名称不能为空");
        }
        stage.setStageId(null);
        stage.setPlanId(planId);
        stage.setTenantId(tenantId);
        if (stage.getStatus() == null) {
            stage.setStatus(1);
        }
        if (stage.getStageSeq() == null) {
            // 新建时序号留空按"排在最后"处理，比默认 0 更符合页面语义
            List<PlanStage> existing = listByPlan(planId, tenantId);
            stage.setStageSeq(existing.stream()
                    .map(PlanStage::getStageSeq)
                    .filter(java.util.Objects::nonNull)
                    .max(Integer::compareTo)
                    .orElse(0) + 1);
        }
        assertDateRange(stage);
        stage.setCreateTime(LocalDateTime.now());
        stage.setUpdateTime(LocalDateTime.now());
        stage.setDeleted(0);
        this.save(stage);
        return stage;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlanStage updateStage(Long planId, Long stageId, PlanStage stage, String tenantId) {
        PlanStage existing = getOwned(planId, stageId, tenantId);
        if (stage == null) {
            throw new BusinessException(400, "阶段内容不能为空");
        }
        if (stage.getStageName() != null && !stage.getStageName().isBlank()) {
            existing.setStageName(stage.getStageName().trim());
        }
        if (stage.getStageSeq() != null) {
            existing.setStageSeq(stage.getStageSeq());
        }
        // 日期用"字段是否出现"判断：前端编辑弹窗清空日期时要真的清掉，落到 null 不能静默保留旧值
        existing.setPlanStartDate(stage.getPlanStartDate());
        existing.setPlanEndDate(stage.getPlanEndDate());
        existing.setActualStartDate(stage.getActualStartDate());
        existing.setActualEndDate(stage.getActualEndDate());
        if (stage.getTaskType() != null) {
            existing.setTaskType(stage.getTaskType());
        }
        if (stage.getDescription() != null) {
            existing.setDescription(stage.getDescription());
        }
        if (stage.getStatus() != null) {
            existing.setStatus(stage.getStatus());
        }
        assertDateRange(existing);
        existing.setUpdateTime(LocalDateTime.now());
        this.updateById(existing);
        return existing;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteStage(Long planId, Long stageId, String tenantId) {
        getOwned(planId, stageId, tenantId);
        this.removeById(stageId);
    }

    /**
     * 取阶段并校验归属（计划 + 租户）。
     *
     * <p>越权与不存在都返回 404：区分开等于告诉调用方"这条记录存在，只是不属于你"。</p>
     */
    private PlanStage getOwned(Long planId, Long stageId, String tenantId) {
        PlanStage stage = this.getById(stageId);
        if (stage == null || !planId.equals(stage.getPlanId()) || !tenantId.equals(stage.getTenantId())) {
            throw new BusinessException(404, "计划阶段不存在：" + stageId);
        }
        return stage;
    }

    /** 计划结束日期不能早于开始日期（两侧都给了才判定）。 */
    private void assertDateRange(PlanStage stage) {
        if (stage.getPlanStartDate() != null && stage.getPlanEndDate() != null
                && stage.getPlanEndDate().isBefore(stage.getPlanStartDate())) {
            throw new BusinessException(400, "阶段结束日期不能早于开始日期");
        }
    }
}
