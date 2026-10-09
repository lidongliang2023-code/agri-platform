package com.agri.core.smoke;

import com.agri.produce.internal.plan.PlanInfoEntity;
import com.agri.produce.internal.plan.PlanInfoMapper;
import com.agri.produce.internal.plan.PlanInfoService;
import com.agri.shared.exception.BusinessException;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 地块同时段唯一「在种」计划强校验（R-PLAN-01）单元测试。
 *
 * <p><b>纯 Mockito，不起 Spring 上下文、不连库</b>：本用例钉的是状态口径与冲突判定逻辑，
 * 与数据源无关，因此可以常驻 CI（与 {@link CoreAppStartupSmokeTest} 同一原则）。</p>
 *
 * <p>重点守住两条容易被改坏的口径：
 * <ol>
 *   <li>{@code status=2（进行中）} 才算「在种」，{@code 3（已完成）} 不参与冲突判定；</li>
 *   <li>冲突必须抛 409（{@code ErrorCode.CONFLICT}），且报文带上冲突计划 ID / 名称 / 负责人。</li>
 * </ol>
 */
class PlanGrowingConflictTest {

    private static final String PLOT = "PLOT-001";

    /**
     * 纯单测没有 SqlSessionFactory，MyBatis-Plus 的 lambda 缓存未初始化，
     * 解析 {@code PlanInfoEntity::getStatus} 时会抛「can not find lambda cache」。
     * 这里手工注册一次实体元数据即可（不影响任何真实数据源）。
     */
    @BeforeAll
    static void initMybatisPlusMetadata() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), "PlanGrowingConflictTest"),
                PlanInfoEntity.class);
    }

    private final PlanInfoMapper planInfoMapper = mock(PlanInfoMapper.class);

    private final PlanInfoService planInfoService = new PlanInfoService(planInfoMapper);

    /**
     * 构造一个待校验的计划。
     *
     * @param status 计划状态
     * @param start  开始日期
     * @param end    结束日期
     * @return 计划实体
     */
    private static PlanInfoEntity plan(Integer status, LocalDate start, LocalDate end) {
        PlanInfoEntity entity = new PlanInfoEntity();
        entity.setPlanId("PLAN-NEW");
        entity.setPlotId(PLOT);
        entity.setPlanName("新计划");
        entity.setStatus(status);
        entity.setPlanStartDate(start);
        entity.setPlanEndDate(end);
        return entity;
    }

    @Test
    @DisplayName("状态2（进行中）撞上另一个在种计划 → 409，且报文带冲突计划ID/名称/负责人")
    void growingPlanConflicts() {
        PlanInfoEntity existing = new PlanInfoEntity();
        existing.setPlanId("PLAN-OLD");
        existing.setPlanName("越冬小麦");
        existing.setOwnerId("U-007");
        when(planInfoMapper.selectList(any())).thenReturn(List.of(existing));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> planInfoService.create(plan(2,
                        LocalDate.of(2026, 3, 1), LocalDate.of(2026, 9, 1))));

        assertEquals(409, ex.getCode(), "冲突必须返回 409，而不是 400");
        assertTrue(ex.getMessage().contains("PLAN-OLD"), "报文需带冲突计划 ID");
        assertTrue(ex.getMessage().contains("越冬小麦"), "报文需带冲突计划名称");
        assertTrue(ex.getMessage().contains("U-007"), "报文需带冲突计划负责人");
    }

    @Test
    @DisplayName("状态3（已完成）不参与冲突判定：已完成计划不占地块")
    void finishedPlanDoesNotConflict() {
        planInfoService.create(plan(3, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 9, 1)));

        verify(planInfoMapper).insert(any());
    }

    @Test
    @DisplayName("冲突查询的状态集合只含2：3（已完成）不能进 IN 条件")
    void conflictQueryOnlyContainsGrowingStatus() {
        when(planInfoMapper.selectList(any())).thenReturn(List.of());
        planInfoService.create(plan(2, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 9, 1)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<LambdaQueryWrapper<PlanInfoEntity>> captor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(planInfoMapper).selectList(captor.capture());

        // IN 的值不出现在 SQL 片段里（走 ? 占位），只能从参数映射里取证
        Collection<Object> params = captor.getValue().getParamNameValuePairs().values();
        assertTrue(captor.getValue().getTargetSql().contains("status"), "冲突查询必须带 status 条件");
        assertTrue(params.contains(2), "在种状态 2 必须在 IN 集合内");
        assertFalse(params.contains(3), "status 3（已完成）不得进 IN 集合，否则会误拦新计划");
    }

    @Test
    @DisplayName("结束日期早于开始日期 → 400，且不查库")
    void invalidRangeRejected() {
        assertThrows(BusinessException.class,
                () -> planInfoService.create(plan(2,
                        LocalDate.of(2026, 9, 1), LocalDate.of(2026, 3, 1))));
        verify(planInfoMapper, org.mockito.Mockito.never()).selectList(any());
    }
}
