package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.growth.GrowthRecordEntity;
import com.agri.produce.internal.growth.GrowthRecordMapper;
import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.produce.internal.iot.IotDeviceEntity;
import com.agri.produce.internal.iot.IotDeviceMapper;
import com.agri.produce.internal.plot.PlotInfoEntity;
import com.agri.produce.internal.plot.PlotInfoMapper;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.InspectionMapper;
import com.agri.produce.internal.task.TaskInfoEntity;
import com.agri.produce.internal.task.TaskInfoMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 运营端看板聚合服务（只读汇总，跨生产域子包查询，属同模块内部调用）。
 */
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final FarmInfoMapper farmInfoMapper;
    private final PlotInfoMapper plotInfoMapper;
    private final TaskInfoMapper taskInfoMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final InspectionMapper inspectionMapper;
    private final AlertInfoMapper alertInfoMapper;
    private final IotDeviceMapper iotDeviceMapper;
    private final GrowthRecordMapper growthRecordMapper;

    /** 时间轴展示格式（HH:mm:ss），大屏实时滚动条用 */
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm:ss");
    /** 趋势横轴格式（MM-DD） */
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("MM-dd");
    /** 未填写省份的农场归入此分组，避免用"未知区域"之类的猜测名 */
    private static final String PROVINCE_EMPTY = "未填写";
    /** 未填写作物的地块归入此分组 */
    private static final String VALUE_EMPTY = "未填写";
    /** 未归属租户的农场归入此分组 */
    private static final String TENANT_EMPTY = "未归属";
    /** overview-rows 支持的统计维度（三个维度均有真实数据源） */
    private static final List<String> SUPPORTED_DIMENSIONS = List.of("region", "crop", "tenant");

    /**
     * 看板总览：农场/地块/任务/批次/告警/设备在线。
     *
     * @return 指标集合
     */
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmCount", farmInfoMapper.selectCount(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1)));
        result.put("plotCount", plotInfoMapper.selectCount(new LambdaQueryWrapper<PlotInfoEntity>()
                .ne(PlotInfoEntity::getStatus, 0)));
        result.put("taskPending", taskInfoMapper.selectCount(new LambdaQueryWrapper<TaskInfoEntity>()
                .in(TaskInfoEntity::getStatus, List.of("pending", "assigned", "doing"))));
        result.put("batchInStock", harvestBatchMapper.selectCount(new LambdaQueryWrapper<HarvestBatchEntity>()
                .eq(HarvestBatchEntity::getStatus, 1)));
        result.put("inspectionPass", inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "PASS")));
        result.put("inspectionFail", inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "FAIL")));
        result.put("alertPending", alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, "PENDING")));
        result.put("deviceOnline", iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getOnlineFlag, 1)));
        result.put("deviceTotal", iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getStatus, 1)));
        return result;
    }

    /**
     * 种植面积排行（按农场取前 limit 名）。
     *
     * @param limit 返回条数
     * @return 排行列表
     */
    public List<Map<String, Object>> rank(int limit) {
        List<FarmInfoEntity> farms = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (FarmInfoEntity farm : farms) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("farmId", farm.getFarmId());
            row.put("farmName", farm.getFarmName());
            row.put("areaTotal", farm.getAreaTotal() == null ? BigDecimal.ZERO : farm.getAreaTotal());
            row.put("plotCount", plotInfoMapper.selectCount(new LambdaQueryWrapper<PlotInfoEntity>()
                    .eq(PlotInfoEntity::getFarmId, farm.getFarmId())));
            rows.add(row);
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("areaTotal")).compareTo((BigDecimal) a.get("areaTotal")));
        return rows.size() <= limit ? rows : new ArrayList<>(rows.subList(0, limit));
    }

    /**
     * 告警级别分布趋势（看板饼图）。
     *
     * @return 级别 → 数量
     */
    public Map<String, Object> alertTrend() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String level : List.of("INFO", "WARN", "CRITICAL")) {
            result.put(level, alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                    .eq(AlertInfoEntity::getAlertLevel, level)));
        }
        return result;
    }

    /**
     * 近 N 天生产趋势（运营端 OpsDashboard 折线图）。
     *
     * <p>字段口径全部来自现成表的真实聚合，不做任何推测填补：</p>
     * <ul>
     *   <li>{@code taskRate}：当日到期（plan_end_date）的任务中已 done 的占比；当日无到期任务记 0。</li>
     *   <li>{@code activeWorkers}：当日有生产作业记录的不同 memberId 去重，
     *       <b>非登录活跃用户</b>。平台没有埋点/登录流水表，"活跃用户数"在本项目无数据源，
     *       因此字段不叫 activeUsers——叫那个名字就是把作业人数包装成活跃用户。
     *       本字段的真实口径是「作业人数」：采收作业人（harvest operator_id）
     *       ∪ 生长记录人（growth recorder_id）去重后的数量。</li>
     *   <li>{@code alertCount}：当日产生的告警数（按 alert_time）。</li>
     * </ul>
     *
     * @param days 天数，默认 7
     * @return 按日期升序的趋势点
     */
    public List<Map<String, Object>> trend(int days) {
        int span = Math.max(1, Math.min(days, 90));
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(span - 1L);
        LocalDateTime fromStart = from.atStartOfDay();
        LocalDateTime toEnd = today.plusDays(1).atStartOfDay();

        List<TaskInfoEntity> tasks = taskInfoMapper.selectList(new LambdaQueryWrapper<TaskInfoEntity>()
                .ge(TaskInfoEntity::getPlanEndDate, from)
                .le(TaskInfoEntity::getPlanEndDate, today));
        List<AlertInfoEntity> alerts = alertInfoMapper.selectList(new LambdaQueryWrapper<AlertInfoEntity>()
                .ge(AlertInfoEntity::getAlertTime, fromStart)
                .lt(AlertInfoEntity::getAlertTime, toEnd));
        List<HarvestBatchEntity> batches = harvestBatchMapper.selectList(new LambdaQueryWrapper<HarvestBatchEntity>()
                .ge(HarvestBatchEntity::getHarvestDate, from)
                .le(HarvestBatchEntity::getHarvestDate, today));
        List<GrowthRecordEntity> records = growthRecordMapper.selectList(new LambdaQueryWrapper<GrowthRecordEntity>()
                .ge(GrowthRecordEntity::getRecordDate, from)
                .le(GrowthRecordEntity::getRecordDate, today));

        List<Map<String, Object>> points = new ArrayList<>();
        for (int i = 0; i < span; i++) {
            LocalDate day = from.plusDays(i);
            long due = tasks.stream().filter(t -> day.equals(t.getPlanEndDate())).count();
            long done = tasks.stream()
                    .filter(t -> day.equals(t.getPlanEndDate()) && "done".equals(t.getStatus()))
                    .count();
            long alertCount = alerts.stream()
                    .filter(a -> a.getAlertTime() != null && day.equals(a.getAlertTime().toLocalDate()))
                    .count();
            Set<String> workers = new HashSet<>();
            batches.stream()
                    .filter(b -> day.equals(b.getHarvestDate()) && b.getOperatorId() != null)
                    .forEach(b -> workers.add(b.getOperatorId()));
            records.stream()
                    .filter(r -> day.equals(r.getRecordDate()) && r.getRecorderId() != null)
                    .forEach(r -> workers.add(r.getRecorderId()));

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("label", day.format(DAY_LABEL));
            point.put("date", day.toString());
            // 计数一律以 int 输出 → JSON 数字。若用 long 会被全局 Long→String
            // 序列化成 "1"，与同对象里的 activeWorkers（int→数字）混成两套类型，
            // 前端一旦直接比较就会出现 "10" > "9" === false 这类静默错判。
            point.put("taskRate", due == 0 ? 0 : (int) Math.round(done * 100.0 / due));
            point.put("taskDue", (int) due);
            point.put("taskDone", (int) done);
            point.put("activeWorkers", workers.size());
            point.put("alertCount", (int) alertCount);
            points.add(point);
        }
        return points;
    }

    /**
     * 生产总览维度统计行（运营端 OpsProductionOverview）。
     *
     * <p><b>为什么必须收 dimension 参数。</b>前端 {@code OpsProductionOverview.tsx:149} 会传
     * {@code dimension}（region / crop / tenant）、{@code region}、{@code startDate} /
     * {@code endDate}。此前本端点不收任何参数、恒按省份聚合，等于把这四个入参静默丢弃：
     * 用户在页面上选「按作物」或「按租户」，拿到的却还是按省份分组的行——
     * <b>真实数据被贴上了错误的维度标签</b>，比保留兜底数据更糟（因为它看起来完全正常）。
     * 现在四个入参全部真实生效。</p>
     *
     * <p><b>维度的真实数据源：</b></p>
     * <ul>
     *   <li>{@code region} → {@code prod_farm_info.province}（库里没有 region 列，但有真实省份值）</li>
     *   <li>{@code crop}   → {@code prod_plot_info.crop_id}</li>
     *   <li>{@code tenant} → 农场上的 {@code tenant_id}</li>
     * </ul>
     * 三个维度都有真实取值；维度值缺失时归入 {@code 未填写} / {@code 未归属}，不猜名字。
     *
     * <p><b>时间范围的适用边界（如实说明，不假装全量生效）：</b>{@code startDate} /
     * {@code endDate} 只对<b>有时间属性的指标</b>生效——产量（采收日期）、告警数（告警时间）；
     * 而农场数、在田面积、任务完成率是<b>存量快照</b>，不受时间过滤。宁可少过滤，
     * 也不能让"面积随时间变化"这种无依据的口径混进来。</p>
     *
     * <p>{@code outputTon} 由采收批次 quantity 折算：单位 kg 除以 1000，单位 t/吨 原样计入，
     * 其余单位不折算也不计入（避免把"箱/件"当成吨）。</p>
     *
     * @param dimension 统计维度：region / crop / tenant，缺省 region
     * @param region    省份过滤，空表示不过滤
     * @param startDate 起始日期，空表示不限
     * @param endDate   截止日期，空表示不限
     * @return 维度统计行，按农场数倒序
     */
    public List<Map<String, Object>> overviewRows(String dimension, String region,
                                                  LocalDate startDate, LocalDate endDate) {
        String dim = dimension == null || dimension.isBlank() ? "region" : dimension.trim();
        if (!SUPPORTED_DIMENSIONS.contains(dim)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "不支持的统计维度：" + dim + "（仅支持 region / crop / tenant）");
        }
        boolean cropDim = "crop".equals(dim);

        List<FarmInfoEntity> farms = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1));
        if (region != null && !region.isBlank()) {
            String target = region.trim();
            farms = farms.stream()
                    .filter(f -> target.equals(f.getProvince() == null ? "" : f.getProvince().trim()))
                    .toList();
        }
        Set<String> farmIdScope = new HashSet<>();
        for (FarmInfoEntity farm : farms) {
            farmIdScope.add(farm.getFarmId());
        }
        Map<String, String> farmKey = new LinkedHashMap<>();
        for (FarmInfoEntity farm : farms) {
            farmKey.put(farm.getFarmId(), cropDim ? "" : groupKeyOf(dim, farm));
        }
        List<PlotInfoEntity> plots = plotInfoMapper.selectList(null).stream()
                .filter(p -> farmIdScope.contains(p.getFarmId()))
                .toList();
        List<TaskInfoEntity> tasks = taskInfoMapper.selectList(null);
        List<AlertInfoEntity> alerts = alertInfoMapper.selectList(null);
        List<HarvestBatchEntity> batches = harvestBatchMapper.selectList(null);

        // 分组：作物维度以地块为粒度（一个农场可能落入多个作物分组），其余以农场为粒度
        Map<String, Set<String>> groupPlots = new LinkedHashMap<>();
        Map<String, Set<String>> groupFarms = new LinkedHashMap<>();
        Map<String, BigDecimal> groupArea = new LinkedHashMap<>();
        if (cropDim) {
            for (PlotInfoEntity plot : plots) {
                String key = plot.getCropId() == null || plot.getCropId().isBlank()
                        ? VALUE_EMPTY : plot.getCropId().trim();
                groupPlots.computeIfAbsent(key, k -> new LinkedHashSet<>()).add(plot.getPlotId());
                groupFarms.computeIfAbsent(key, k -> new LinkedHashSet<>()).add(plot.getFarmId());
                groupArea.merge(key, nvl(plot.getArea()), BigDecimal::add);
            }
        } else {
            for (FarmInfoEntity farm : farms) {
                String key = groupKeyOf(dim, farm);
                groupFarms.computeIfAbsent(key, k -> new LinkedHashSet<>()).add(farm.getFarmId());
                groupArea.merge(key, nvl(farm.getAreaTotal()), BigDecimal::add);
            }
            for (PlotInfoEntity plot : plots) {
                String key = farmKey.get(plot.getFarmId());
                if (key != null) {
                    groupPlots.computeIfAbsent(key, k -> new LinkedHashSet<>()).add(plot.getPlotId());
                }
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (String key : groupFarms.keySet()) {
            Set<String> plotIds = groupPlots.getOrDefault(key, Set.of());
            Set<String> farmIds = groupFarms.getOrDefault(key, Set.of());
            int taskTotal = (int) tasks.stream().filter(t -> plotIds.contains(t.getPlotId())).count();
            int taskDone = (int) tasks.stream()
                    .filter(t -> plotIds.contains(t.getPlotId()) && "done".equals(t.getStatus()))
                    .count();
            int alertCount = (int) alerts.stream()
                    .filter(a -> farmIds.contains(a.getFarmId()) && inRange(a.getAlertTime(), startDate, endDate))
                    .count();
            BigDecimal outputTon = BigDecimal.ZERO;
            for (HarvestBatchEntity batch : batches) {
                if (plotIds.contains(batch.getPlotId()) && inRange(batch.getHarvestDate(), startDate, endDate)) {
                    outputTon = outputTon.add(toTon(batch));
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", key);
            row.put("farmCount", farmIds.size());
            row.put("fieldArea", groupArea.getOrDefault(key, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
            row.put("outputTon", outputTon.setScale(3, RoundingMode.HALF_UP));
            row.put("taskTotal", taskTotal);
            row.put("taskDone", taskDone);
            row.put("taskRate", taskTotal == 0 ? 0 : (int) Math.round(taskDone * 100.0 / taskTotal));
            row.put("alertCount", alertCount);
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt((Map<String, Object> r) -> (Integer) r.get("farmCount")).reversed()
                .thenComparing(r -> String.valueOf(r.get("name"))));
        return rows;
    }

    /**
     * 按维度取农场所属分组键。
     *
     * @param dim  维度（region / tenant）
     * @param farm 农场
     * @return 分组键
     */
    private String groupKeyOf(String dim, FarmInfoEntity farm) {
        if ("tenant".equals(dim)) {
            return farm.getTenantId() == null ? TENANT_EMPTY : String.valueOf(farm.getTenantId());
        }
        return farm.getProvince() == null || farm.getProvince().isBlank()
                ? PROVINCE_EMPTY : farm.getProvince().trim();
    }

    /**
     * 判 LocalDateTime 是否落在日期区间内（闭区间）；区间为空表示不限。
     *
     * @param time      时间，null 视为不在区间内
     * @param startDate 起始日期，可空
     * @param endDate   截止日期，可空
     * @return 命中返回 true
     */
    private boolean inRange(LocalDateTime time, LocalDate startDate, LocalDate endDate) {
        if (time == null) {
            return false;
        }
        return inRange(time.toLocalDate(), startDate, endDate);
    }

    /**
     * 判 LocalDate 是否落在日期区间内（闭区间）；区间为空表示不限。
     *
     * @param date      日期，null 视为不在区间内
     * @param startDate 起始日期，可空
     * @param endDate   截止日期，可空
     * @return 命中返回 true
     */
    private boolean inRange(LocalDate date, LocalDate startDate, LocalDate endDate) {
        if (date == null) {
            return false;
        }
        if (startDate != null && date.isBefore(startDate)) {
            return false;
        }
        return endDate == null || !date.isAfter(endDate);
    }

    /**
     * BigDecimal 空值归零。
     *
     * @param value 原值
     * @return 非空的原值或零
     */
    private BigDecimal nvl(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /**
     * 大屏实时滚动指标（运营端 OpsDataScreen）：告警 + 采收入库 + 任务完成，按时间倒序取最新 N 条。
     *
     * @param limit 条数
     * @return 实时指标列表
     */
    public List<Map<String, Object>> realtime(int limit) {
        int size = Math.max(1, Math.min(limit, 100));
        Map<String, String> farmName = new LinkedHashMap<>();
        for (FarmInfoEntity farm : farmInfoMapper.selectList(null)) {
            farmName.put(farm.getFarmId(), farm.getFarmName());
        }
        Map<String, String> plotFarm = new LinkedHashMap<>();
        for (PlotInfoEntity plot : plotInfoMapper.selectList(null)) {
            plotFarm.put(plot.getPlotId(), plot.getFarmId());
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (AlertInfoEntity alert : alertInfoMapper.selectList(null)) {
            if (alert.getAlertTime() == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("metricId", alert.getAlertId());
            item.put("time", alert.getAlertTime().format(CLOCK));
            item.put("sortTime", alert.getAlertTime());
            item.put("targetName", farmName.getOrDefault(alert.getFarmId(), "未关联农场"));
            item.put("content", "[" + alert.getAlertLevel() + "] " + alert.getAlertTitle());
            item.put("isAlert", true);
            items.add(item);
        }
        for (HarvestBatchEntity batch : harvestBatchMapper.selectList(null)) {
            LocalDateTime at = batch.getCreatedAt();
            if (at == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("metricId", batch.getBatchId());
            item.put("time", at.format(CLOCK));
            item.put("sortTime", at);
            item.put("targetName", farmName.getOrDefault(plotFarm.get(batch.getPlotId()), "未关联农场"));
            item.put("content", "采收入库 " + (batch.getQuantity() == null ? "—" : batch.getQuantity())
                    + (batch.getUnit() == null ? "" : batch.getUnit()));
            item.put("isAlert", false);
            items.add(item);
        }
        for (TaskInfoEntity task : taskInfoMapper.selectList(new LambdaQueryWrapper<TaskInfoEntity>()
                .eq(TaskInfoEntity::getStatus, "done"))) {
            if (task.getCompletedAt() == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("metricId", task.getTaskId());
            item.put("time", task.getCompletedAt().format(CLOCK));
            item.put("sortTime", task.getCompletedAt());
            item.put("targetName", farmName.getOrDefault(plotFarm.get(task.getPlotId()), "未关联农场"));
            item.put("content", "任务完成：" + task.getTaskName());
            item.put("isAlert", false);
            items.add(item);
        }
        items.sort(Comparator.comparing((Map<String, Object> m) -> (LocalDateTime) m.get("sortTime")).reversed());
        List<Map<String, Object>> result = items.size() <= size ? items : new ArrayList<>(items.subList(0, size));
        result.forEach(item -> item.remove("sortTime"));
        return result;
    }

    /**
     * 生长趋势分页（数据源 {@code prod_growth_record}）。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 分页结果
     */
    public PageResult<Map<String, Object>> growthTrend(long page, long size) {
        Page<GrowthRecordEntity> records = growthRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<GrowthRecordEntity>()
                        .orderByDesc(GrowthRecordEntity::getRecordDate));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (GrowthRecordEntity record : records.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("recordId", record.getRecordId());
            row.put("plotId", record.getPlotId());
            row.put("cropId", record.getCropId());
            row.put("recordDate", record.getRecordDate());
            row.put("growthStage", record.getGrowthStage());
            row.put("height", record.getHeight());
            row.put("leafCount", record.getLeafCount());
            row.put("pestLevel", record.getPestLevel());
            rows.add(row);
        }
        return PageResult.of(rows, records.getTotal(), page, size);
    }

    /**
     * 采收产量折算为吨。
     *
     * <p>只认 kg 与 t/吨两类可确定的单位；其余单位（箱/件/个等）无法可靠折算，
     * 计 0 —— 宁可少算，也不能把"箱"当成吨。</p>
     *
     * @param batch 采收批次
     * @return 吨数
     */
    private BigDecimal toTon(HarvestBatchEntity batch) {
        if (batch.getQuantity() == null) {
            return BigDecimal.ZERO;
        }
        String unit = batch.getUnit() == null ? "" : batch.getUnit().trim();
        if ("kg".equalsIgnoreCase(unit)) {
            return batch.getQuantity().divide(BigDecimal.valueOf(1000), 3, RoundingMode.HALF_UP);
        }
        if ("t".equalsIgnoreCase(unit) || "吨".equals(unit)) {
            return batch.getQuantity();
        }
        return BigDecimal.ZERO;
    }
}
