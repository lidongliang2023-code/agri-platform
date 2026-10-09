package com.agri.produce.internal.plan;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 种养计划阶段（整地/播种/施肥…） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class PlanStageService {

    private static final String ID_PREFIX = "PSTG";

    private final PlanStageMapper planStageMapper;

    /**
     * 分页查询。
     *
     * @param keyword stageName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<PlanStageEntity> page(long page, long size, String keyword, Integer status) {
        Page<PlanStageEntity> result = planStageMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<PlanStageEntity>()
                        .like(keyword != null && !keyword.isBlank(), PlanStageEntity::getStageName, keyword)
                        .eq(status != null, PlanStageEntity::getStatus, status)
                        .orderByDesc(PlanStageEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public PlanStageEntity detail(String id) {
        PlanStageEntity entity = planStageMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public PlanStageEntity create(PlanStageEntity entity) {
        if (entity.getStageId() == null || entity.getStageId().isBlank()) {
            entity.setStageId(ProduceIds.newId(ID_PREFIX));
        }
        planStageMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public PlanStageEntity update(String id, PlanStageEntity entity) {
        entity.setStageId(id);
        planStageMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        planStageMapper.deleteById(id);
    }

    /** 计划的阶段列表（按序号升序） */
    public List<PlanStageEntity> listByPlan(String planId) {
        return planStageMapper.selectList(new LambdaQueryWrapper<PlanStageEntity>()
                .eq(PlanStageEntity::getPlanId, planId)
                .orderByAsc(PlanStageEntity::getStageSeq));
    }
}
