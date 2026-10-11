package com.agri.produce.internal.analytics;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.common.ProduceIds;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.produce.internal.iot.IotDeviceEntity;
import com.agri.produce.internal.iot.IotDeviceMapper;
import com.agri.produce.internal.plot.PlotInfoEntity;
import com.agri.produce.internal.plot.PlotInfoMapper;
import com.agri.produce.internal.plan.PlanInfoEntity;
import com.agri.produce.internal.plan.PlanInfoMapper;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.InspectionMapper;
import com.agri.produce.internal.task.TaskInfoEntity;
import com.agri.produce.internal.task.TaskInfoMapper;
import com.agri.produce.internal.task.TaskStatus;
import com.agri.produce.internal.trace.TraceCodeEntity;
import com.agri.produce.internal.trace.TraceCodeMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 分析指标快照（产量/成本/达标率，T+1 汇聚） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class AnalyticsSnapshotService {

    private static final String ID_PREFIX = "ANLS";

    private final AnalyticsSnapshotMapper analyticsSnapshotMapper;
    private final FarmInfoMapper farmInfoMapper;
    private final PlotInfoMapper plotInfoMapper;
    private final PlanInfoMapper planInfoMapper;
    private final TaskInfoMapper taskInfoMapper;
    private final AlertInfoMapper alertInfoMapper;
    private final IotDeviceMapper iotDeviceMapper;
    private final TraceCodeMapper traceCodeMapper;
    private final InspectionMapper inspectionMapper;
    private final HarvestBatchMapper harvestBatchMapper;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<AnalyticsSnapshotEntity> page(long page, long size, Integer status) {
        Page<AnalyticsSnapshotEntity> result = analyticsSnapshotMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                        .eq(status != null, AnalyticsSnapshotEntity::getStatus, status)
                        .orderByDesc(AnalyticsSnapshotEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public AnalyticsSnapshotEntity detail(String id) {
        AnalyticsSnapshotEntity entity = analyticsSnapshotMapper.selectById(id);
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
    public AnalyticsSnapshotEntity create(AnalyticsSnapshotEntity entity) {
        if (entity.getSnapshotId() == null || entity.getSnapshotId().isBlank()) {
            entity.setSnapshotId(ProduceIds.newId(ID_PREFIX));
        }
        analyticsSnapshotMapper.insert(entity);
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
    public AnalyticsSnapshotEntity update(String id, AnalyticsSnapshotEntity entity) {
        entity.setSnapshotId(id);
        analyticsSnapshotMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        analyticsSnapshotMapper.deleteById(id);
    }

    /** 单指标趋势 */
    public List<AnalyticsSnapshotEntity> trend(String metricCode, LocalDate from, LocalDate to) {
        return analyticsSnapshotMapper.selectList(new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                .eq(AnalyticsSnapshotEntity::getMetricCode, metricCode)
                .ge(from != null, AnalyticsSnapshotEntity::getBizDate, from)
                .le(to != null, AnalyticsSnapshotEntity::getBizDate, to)
                .orderByAsc(AnalyticsSnapshotEntity::getBizDate));
    }

    /**
     * 概览：快照指标（按编码取最新值） + 计数类指标（实时聚合）。
     *
     * <p>补计数类指标的原因：用户端首页 17 个指标此前只有快照表里存在的几个
     * （YIELD / PASS_RATE / COST）能返回，其余缺失 → 前端按「后端暂无数据源」渲染成「—」，
     * 而运营端大盘同源指标是有数的，两端对不上。本方法按运营端同口径补齐。</p>
     *
     * <p>口径（逐项与运营端大盘对应）：farmCount = 启用农场数（status=1）；
     * plotCount = 地块数（status&lt;&gt;0）；plantingArea = 上述地块面积之和（亩）；
     * cropCount = 上述地块去重作物数；pendingTaskCount = 未完成农事任务数
     * （{@link TaskStatus#unfinishedValues()}，兼容新旧两套词表）；
     * monthTaskTotal / monthTaskDone / taskCompletionRate 按自然月统计
     * （以 planStartDate 落在本月为界，本月无任务时完成率为 null，无分母不填 0）；
     * alertCount = 未处理告警数（status=PENDING，处理中不计入）；
     * activeDeviceCount = 在线设备数（online_flag=1）；traceCodeCount = 已激活溯源码数（ACTIVE）；
     * passRate = 检测合格率 = PASS/(PASS+FAIL)，无检测记录时为 null；
     * monthHarvestQty = 本月采收量（harvest_date 在本月内的 quantity 之和）。</p>
     *
     * <p>已知未接项（保持缺省，不编造口径）：runningPlanCount（库内计划状态是数字码 1/2，
     * 语义待产品确认）、avgCostPerMu（无数据源）。</p>
     *
     * <p>作用域：计数类指标为租户全量口径（与运营端一致）；farmId 只作用于快照类指标。</p>
     *
     * @param farmId 农场 ID，仅用于过滤快照指标；可为空
     * @return 指标集合
     */
    public Map<String, Object> overview(String farmId) {
        Map<String, Object> result = new LinkedHashMap<>();

        // 1) 快照指标：每个 metricCode 取最新一条（原有行为不变）
        List<AnalyticsSnapshotEntity> list = analyticsSnapshotMapper.selectList(
                new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                        .eq(farmId != null && !farmId.isBlank(), AnalyticsSnapshotEntity::getFarmId, farmId)
                        .orderByDesc(AnalyticsSnapshotEntity::getBizDate));
        for (AnalyticsSnapshotEntity snapshot : list) {
            if (snapshot.getMetricCode() == null) {
                continue;
            }
            result.putIfAbsent(snapshot.getMetricCode(), snapshot.getMetricValue());
        }
        result.put("metricCount", list.size());

        // 合格率的口径统一在本方法末段处理：快照 PASS_RATE 与实时 passRate 对齐成同一个值，
        // 详见下方 passRate 赋值处。此处不做删除，避免其它读取方拿到空值。

        // 快照指标的小写别名补齐（前端按 avgCostPerMu 取值，库内编码是 COST）。
        //
        // 事实核对（勿再误判为大写别名失效）：大写别名本身是好用的 —— 页面「累计产量
        // 412,300」正是取的 YIELD。页面显示「—」的真实原因是**快照表覆盖面太小**：
        // prod_analytics_snapshot 仅 6 行，COST 只有 DEMO-FARM-001/005、PASS_RATE 只有
        // 001/003、YIELD 只有 001/002；当页面传入 DEMO-FARM-002 时，按 farmId 过滤后
        // 只剩 YIELD 一行，故 COST / PASS_RATE 取不到值。
        // 因此这里补的别名只在「该农场确实有 COST 快照行」时生效；要真正点亮亩均成本，
        // 需补该农场的快照种子或另订 COST 口径（属数据/产品决策，不在代码内兜底）。
        if (result.get("avgCostPerMu") == null && result.get("COST") != null) {
            result.put("avgCostPerMu", result.get("COST"));
        }

        // 2) 计数类指标：实时聚合，**按当前农场下钻**（farmId 为空时退化为租户全量）
        boolean scoped = farmId != null && !farmId.isBlank();
        result.put("farmCount", farmInfoMapper.selectCount(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1)
                .eq(scoped, FarmInfoEntity::getFarmId, farmId)));

        // 地块既是自身指标，也是「任务 / 采收」到农场的唯一桥梁：
        // prod_task_info 与 prod_harvest_batch 都只有 plot_id，没有 farm_id。
        List<PlotInfoEntity> plots = plotInfoMapper.selectList(new LambdaQueryWrapper<PlotInfoEntity>()
                .ne(PlotInfoEntity::getStatus, 0)
                .eq(scoped, PlotInfoEntity::getFarmId, farmId));
        BigDecimal areaSum = BigDecimal.ZERO;
        Set<String> cropIds = new LinkedHashSet<>();
        Set<String> plotIds = new LinkedHashSet<>();
        for (PlotInfoEntity plot : plots) {
            if (plot.getArea() != null) {
                areaSum = areaSum.add(plot.getArea());
            }
            if (plot.getCropId() != null && !plot.getCropId().isBlank()) {
                cropIds.add(plot.getCropId());
            }
            if (plot.getPlotId() != null && !plot.getPlotId().isBlank()) {
                plotIds.add(plot.getPlotId());
            }
        }
        result.put("plotCount", (long) plots.size());
        result.put("plantingArea", areaSum);
        result.put("cropCount", (long) cropIds.size());

        // 下钻到某个农场、而该农场没有地块时，`IN ()` 会生成非法 SQL，故直接判零。
        boolean noPlotInScope = scoped && plotIds.isEmpty();
        result.put("pendingTaskCount", noPlotInScope ? 0L
                : taskInfoMapper.selectCount(new LambdaQueryWrapper<TaskInfoEntity>()
                        .in(scoped, TaskInfoEntity::getPlotId, plotIds)
                        .in(TaskInfoEntity::getStatus, TaskStatus.unfinishedValues())));

        // 进行中计划数：种养计划状态口径见前端 types/plan.ts ——
        // 「1 草稿 2 待审批 3 进行中 4 已完成 5 已终止」，故取 status=3。
        // 注意勿与「生育期阶段状态」（0取消/1未开始/2进行中/3已完成，见 PlanDetail.tsx）混淆，
        // 那是 prod_plan_stage 的口径，不是本指标。
        result.put("runningPlanCount", planInfoMapper.selectCount(new LambdaQueryWrapper<PlanInfoEntity>()
                .eq(PlanInfoEntity::getStatus, 3)
                .eq(scoped, PlanInfoEntity::getFarmId, farmId)));

        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        LocalDate nextMonthStart = monthStart.plusMonths(1);
        long monthTaskTotal = noPlotInScope ? 0L
                : taskInfoMapper.selectCount(new LambdaQueryWrapper<TaskInfoEntity>()
                        .in(scoped, TaskInfoEntity::getPlotId, plotIds)
                        .ge(TaskInfoEntity::getPlanStartDate, monthStart)
                        .lt(TaskInfoEntity::getPlanStartDate, nextMonthStart));
        long monthTaskDone = noPlotInScope ? 0L
                : taskInfoMapper.selectCount(new LambdaQueryWrapper<TaskInfoEntity>()
                        .in(scoped, TaskInfoEntity::getPlotId, plotIds)
                        .ge(TaskInfoEntity::getPlanStartDate, monthStart)
                        .lt(TaskInfoEntity::getPlanStartDate, nextMonthStart)
                        .in(TaskInfoEntity::getStatus, TaskStatus.doneValues()));
        result.put("monthTaskTotal", monthTaskTotal);
        result.put("monthTaskDone", monthTaskDone);
        result.put("taskCompletionRate", monthTaskTotal == 0 ? null
                : BigDecimal.valueOf(monthTaskDone * 100)
                        .divide(BigDecimal.valueOf(monthTaskTotal), 1, RoundingMode.HALF_UP));

        result.put("alertCount", alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, "PENDING")
                .eq(scoped, AlertInfoEntity::getFarmId, farmId)));
        result.put("activeDeviceCount", iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getOnlineFlag, 1)
                .eq(scoped, IotDeviceEntity::getFarmId, farmId)));

        // 保留平台级口径的两个指标（刻意不做假下钻）：
        //   traceCodeCount —— prod_trace_code 既无 farm_id 也无 plot_id，物理上无法按农场归属；
        //   passRate       —— prod_inspection 只有 plot_id；若按农场过滤，多数农场没有检测记录会直接
        //                     变成「—」，反而丢掉当前可用的合格率。两者口径在注释与交付说明中明示。
        result.put("traceCodeCount", traceCodeMapper.selectCount(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getStatus, "ACTIVE")));

        long inspectionPass = inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "PASS"));
        long inspectionFail = inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "FAIL"));
        result.put("passRate", (inspectionPass + inspectionFail) == 0 ? null
                : BigDecimal.valueOf(inspectionPass * 100)
                        .divide(BigDecimal.valueOf(inspectionPass + inspectionFail), 1, RoundingMode.HALF_UP));
        // 合格率单一口径：本方法用 prod_inspection 实时计算（与运营端检测台账同源）为准，
        //   把快照表的 PASS_RATE 对齐成同一个值，而不是删键 —— 删键会让仍在读 PASS_RATE
        //   的消费方静默拿到空值；对齐则"同一指标只有一个数"，且不破坏任何既有读取方。
        //   快照口径本身仍由 /analytics/trend?metricCode=PASS_RATE 供图表使用，不受影响。
        if (result.containsKey("PASS_RATE")) {
            result.put("PASS_RATE", result.get("passRate"));
        }

        BigDecimal harvestQty = BigDecimal.ZERO;
        if (!noPlotInScope) {
            for (HarvestBatchEntity batch : harvestBatchMapper.selectList(
                    new LambdaQueryWrapper<HarvestBatchEntity>()
                            .in(scoped, HarvestBatchEntity::getPlotId, plotIds)
                            .ge(HarvestBatchEntity::getHarvestDate, monthStart)
                            .lt(HarvestBatchEntity::getHarvestDate, nextMonthStart))) {
                if (batch.getQuantity() != null) {
                    harvestQty = harvestQty.add(batch.getQuantity());
                }
            }
        }
        result.put("monthHarvestQty", harvestQty);
        return result;
    }

    /** 报表：按指标分组汇总 */
    public List<Map<String, Object>> reports(String metricCode) {
        List<AnalyticsSnapshotEntity> list = analyticsSnapshotMapper.selectList(
                new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                        .eq(metricCode != null && !metricCode.isBlank(),
                                AnalyticsSnapshotEntity::getMetricCode, metricCode)
                        .orderByDesc(AnalyticsSnapshotEntity::getBizDate));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (AnalyticsSnapshotEntity snapshot : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("metricCode", snapshot.getMetricCode());
            row.put("metricName", snapshot.getMetricName());
            row.put("metricValue", snapshot.getMetricValue());
            row.put("unit", snapshot.getUnit());
            row.put("bizDate", snapshot.getBizDate());
            result.add(row);
        }
        return result;
    }
}
