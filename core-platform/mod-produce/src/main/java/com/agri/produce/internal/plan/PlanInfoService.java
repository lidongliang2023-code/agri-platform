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
import java.time.format.DateTimeFormatter;

/**
 * 种养计划（作物/品种/周期/预期产量） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class PlanInfoService {

    private static final String ID_PREFIX = "PLAN";

    /**
     * 「在种」状态集合：地块同时段只允许存在一个在种计划（R-PLAN-01）。
     *
     * <p>口径（已收敛，唯一取值 <b>2</b>）：状态字典为「1 编制中 2 进行中（在种） 3 已完成 4 已取消」。
     * 三方证据一致——本服务 {@link #start(String)} 写 {@code status=2}；
     * 前端 {@code api/production-view.ts} 注释「启动（1 编制中 → 2 进行中）」「终止（→ 4 已取消）」；
     * V7 迁移亦把误置为 3 的历史数据纠正回 2。</p>
     *
     * <p><b>3=已完成不是「在种」</b>：已完成的计划不再占用地块，若把它算进冲突集合，
     * 会误拦新计划（漏判的反面——过度拦截）。</p>
     */
    public static final List<Integer> GROWING_STATUSES = List.of(2);

    private final PlanInfoMapper planInfoMapper;

    /**
     * 分页查询。
     *
     * @param keyword planName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<PlanInfoEntity> page(long page, long size, String keyword, Integer status) {
        Page<PlanInfoEntity> result = planInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<PlanInfoEntity>()
                        .like(keyword != null && !keyword.isBlank(), PlanInfoEntity::getPlanName, keyword)
                        .eq(status != null, PlanInfoEntity::getStatus, status)
                        .orderByDesc(PlanInfoEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public PlanInfoEntity detail(String id) {
        PlanInfoEntity entity = planInfoMapper.selectById(id);
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
    public PlanInfoEntity create(PlanInfoEntity entity) {
        if (entity.getPlanId() == null || entity.getPlanId().isBlank()) {
            entity.setPlanId(ProduceIds.newId(ID_PREFIX));
        }
        assertNoGrowingConflict(entity);
        planInfoMapper.insert(entity);
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
    public PlanInfoEntity update(String id, PlanInfoEntity entity) {
        entity.setPlanId(id);
        assertNoGrowingConflict(entity);
        planInfoMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        planInfoMapper.deleteById(id);
    }

    /** 启动计划：草稿 → 进行中（进入「在种」态，需先过同时段唯一性校验） */
    @Transactional
    public PlanInfoEntity start(String planId) {
        PlanInfoEntity plan = detail(planId);
        plan.setStatus(2);
        assertNoGrowingConflict(plan);
        planInfoMapper.updateById(plan);
        return plan;
    }

    /** 终止计划 */
    @Transactional
    public PlanInfoEntity terminate(String planId) {
        PlanInfoEntity plan = detail(planId);
        plan.setStatus(4);
        planInfoMapper.updateById(plan);
        return plan;
    }

    /**
     * 地块同时段唯一「在种」计划强校验（R-PLAN-01）。
     *
     * <p>同一地块在日期区间上重叠、且已有计划处于「在种」态时拒绝写入，
     * 冲突信息带上冲突计划的 {@code planId / planName / ownerId}，便于前端直接提示是谁在种、种的什么。</p>
     *
     * <p>区间重叠判定：{@code 已有.start <= 新.end && 已有.end >= 新.start}（闭区间）。
     * 任一侧缺少起止日期时无法判定重叠，跳过校验（不误杀）。</p>
     *
     * @param entity 待写入的计划（update 场景须已带正确 planId，用于排除自身）
     * @throws BusinessException 命中冲突时抛 {@link ErrorCode#CONFLICT}（code=409）
     */
    private void assertNoGrowingConflict(PlanInfoEntity entity) {
        if (entity.getPlotId() == null || entity.getPlotId().isBlank()
                || entity.getPlanStartDate() == null || entity.getPlanEndDate() == null) {
            return;
        }
        if (entity.getPlanEndDate().isBefore(entity.getPlanStartDate())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "计划结束日期不能早于开始日期");
        }
        // 仅「在种」态参与冲突判定；非在种态的计划（草稿/已完成/已终止）不拦截
        if (entity.getStatus() != null && !GROWING_STATUSES.contains(entity.getStatus())) {
            return;
        }

        List<PlanInfoEntity> conflicts = planInfoMapper.selectList(
                new LambdaQueryWrapper<PlanInfoEntity>()
                        .eq(PlanInfoEntity::getPlotId, entity.getPlotId())
                        .in(PlanInfoEntity::getStatus, GROWING_STATUSES)
                        .ne(entity.getPlanId() != null && !entity.getPlanId().isBlank(),
                                PlanInfoEntity::getPlanId, entity.getPlanId())
                        .le(PlanInfoEntity::getPlanStartDate, entity.getPlanEndDate())
                        .ge(PlanInfoEntity::getPlanEndDate, entity.getPlanStartDate())
                        .last("LIMIT 1"));

        if (conflicts.isEmpty()) {
            return;
        }
        PlanInfoEntity conflict = conflicts.get(0);
        throw new BusinessException(ErrorCode.CONFLICT,
                String.format("地块 %s 在 %s ~ %s 期间已存在在种计划：planId=%s，计划名称=%s，负责人=%s",
                        entity.getPlotId(), entity.getPlanStartDate(), entity.getPlanEndDate(),
                        conflict.getPlanId(),
                        conflict.getPlanName() == null ? "（未命名）" : conflict.getPlanName(),
                        conflict.getOwnerId() == null ? "（未指派）" : conflict.getOwnerId()));
    }

    /** 计划日历：按月聚合计划数量 */
    public List<Map<String, Object>> calendar() {
        List<PlanInfoEntity> plans = planInfoMapper.selectList(new LambdaQueryWrapper<PlanInfoEntity>()
                .orderByAsc(PlanInfoEntity::getPlanStartDate));
        Map<String, Long> buckets = new LinkedHashMap<>();
        for (PlanInfoEntity plan : plans) {
            if (plan.getPlanStartDate() == null) {
                continue;
            }
            String month = plan.getPlanStartDate().format(DateTimeFormatter.ofPattern("yyyy-MM"));
            buckets.merge(month, 1L, Long::sum);
        }
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        buckets.forEach((month, count) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", month);
            row.put("planCount", count);
            result.add(row);
        });
        return result;
    }
}
