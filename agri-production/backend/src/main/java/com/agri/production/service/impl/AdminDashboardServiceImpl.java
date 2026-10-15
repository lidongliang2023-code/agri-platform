package com.agri.production.service.impl;

import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.Farm;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Plot;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.IAdminDashboardService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 运营端仪表盘聚合实现。
 *
 * <p><b>每个指标的数据来源与近似，都写在这里</b>（仪表盘最容易悄悄编数）：</p>
 * <ul>
 *   <li>farmCount = 农场表行数；fieldArea = **地块面积求和**（本库地块面积单位是亩）；</li>
 *   <li>outputTon = 采收批次数量求和 ÷ 1000（库里是 kg），按 {@code harvest_date} 落在区间内筛；</li>
 *   <li>taskRate = 已完成 / 全部任务 × 100（按 {@code plan_end_time} 落区间；没有区间就是全部任务）；</li>
 *   <li>alertCount = 告警条数（按 {@code create_time} 落区间）；</li>
 *   <li>activeWorkers = 当日有任务记录的不同执行人（按任务的计划开始时间归属到某天）
 *       —— **不是**登录活跃人数：平台没有埋点与登录流水表，这个口径在页面注释里也写了；</li>
 *   <li>activityLevel = 按区域农场数分层（≥3 高 / =2 中 / 其余低），是一个**约定**，不是后端原有指标。</li>
 * </ul>
 *
 * <p>算不出来的（例如没有时间字段可筛的维度）一律给 0 或 null，并在出参说明里讲清楚，不填一个看起来合理的数。</p>
 */
@Slf4j
@Service
public class AdminDashboardServiceImpl implements IAdminDashboardService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("MM-dd");

    private final FarmMapper farmMapper;
    private final PlotMapper plotMapper;
    private final TaskMapper taskMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final AlertRecordMapper alertRecordMapper;

    public AdminDashboardServiceImpl(FarmMapper farmMapper,
                                     PlotMapper plotMapper,
                                     TaskMapper taskMapper,
                                     HarvestBatchMapper harvestBatchMapper,
                                     AlertRecordMapper alertRecordMapper) {
        this.farmMapper = farmMapper;
        this.plotMapper = plotMapper;
        this.taskMapper = taskMapper;
        this.harvestBatchMapper = harvestBatchMapper;
        this.alertRecordMapper = alertRecordMapper;
    }

    @Override
    public Map<String, Object> overview(String startDate, String endDate) {
        LocalDate from = parseDate(startDate);
        LocalDate to = parseDate(endDate);
        List<Farm> farms = farmMapper.selectList(new LambdaQueryWrapper<>());
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<>());
        List<Task> tasks = taskMapper.selectList(new LambdaQueryWrapper<>());
        List<HarvestBatch> batches = harvestBatchMapper.selectList(new LambdaQueryWrapper<>());
        List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<>());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmCount", farms.size());
        result.put("fieldArea", sumArea(plots));
        result.put("outputTon", harvestTon(batches, from, to));
        result.put("taskRate", taskRate(tasks, from, to));
        result.put("alertCount", countInRange(alerts, from, to).size());
        return result;
    }

    @Override
    public List<Map<String, Object>> overviewRows(String dimension, String startDate, String endDate,
                                                 String region) {
        LocalDate from = parseDate(startDate);
        LocalDate to = parseDate(endDate);
        String dim = dimension == null || dimension.isBlank() ? "region" : dimension.trim().toLowerCase();

        List<Farm> farms = farmMapper.selectList(new LambdaQueryWrapper<>());
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<>());
        List<Task> tasks = taskMapper.selectList(new LambdaQueryWrapper<>());
        List<HarvestBatch> batches = harvestBatchMapper.selectList(new LambdaQueryWrapper<>());
        List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<>());

        if (region != null && !region.isBlank()) {
            // 区域筛选：先缩到该区域的农场，再照常聚合（页面传的是 region=all 之外的具体省名）
            Set<Long> farmIds = farms.stream()
                    .filter(farm -> region.trim().equalsIgnoreCase(farm.getProvince()))
                    .map(Farm::getId).collect(Collectors.toSet());
            farms = farms.stream().filter(f -> farmIds.contains(f.getId())).toList();
            plots = plots.stream().filter(p -> farmIds.contains(p.getFarmId())).toList();
            tasks = tasks.stream().filter(t -> farmIds.contains(t.getFarmId())).toList();
            batches = batches.stream().filter(b -> farmIds.contains(b.getFarmId())).toList();
            alerts = alerts.stream().filter(a -> farmIds.contains(a.getFarmId())).toList();
        }

        Map<String, List<Farm>> grouped = new LinkedHashMap<>();
        switch (dim) {
            case "crop" -> {
                // 作物维度按地块的当前作物分组（地块是"在田"的载体）；租户/产量仍取这些农场的数据
                for (Plot plot : plots) {
                    String crop = plot.getCurrentCrop() == null || plot.getCurrentCrop().isBlank()
                            ? "未标注作物" : plot.getCurrentCrop().trim();
                    Farm farm = farms.stream().filter(f -> f.getId().equals(plot.getFarmId())).findFirst().orElse(null);
                    if (farm != null) {
                        grouped.computeIfAbsent(crop, key -> new ArrayList<>()).add(farm);
                    }
                }
            }
            case "tenant" -> farms.forEach(farm -> grouped
                    .computeIfAbsent(farm.getTenantId() == null ? "未标注租户" : farm.getTenantId(),
                            key -> new ArrayList<>())
                    .add(farm));
            default -> farms.forEach(farm -> grouped
                    .computeIfAbsent(regionOf(farm), key -> new ArrayList<>())
                    .add(farm));
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, List<Farm>> entry : grouped.entrySet()) {
            Set<Long> farmIds = entry.getValue().stream().map(Farm::getId).collect(Collectors.toCollection(LinkedHashSet::new));
            List<Plot> groupPlots = plots.stream().filter(p -> farmIds.contains(p.getFarmId())).toList();
            List<Task> groupTasks = tasks.stream().filter(t -> farmIds.contains(t.getFarmId())).toList();
            List<HarvestBatch> groupBatches = batches.stream().filter(b -> farmIds.contains(b.getFarmId())).toList();
            List<AlertRecord> groupAlerts = alerts.stream().filter(a -> farmIds.contains(a.getFarmId())).toList();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", entry.getKey());
            row.put("farmCount", farmIds.size());
            row.put("fieldArea", sumArea(groupPlots));
            row.put("outputTon", harvestTon(groupBatches, from, to));
            row.put("taskRate", taskRate(groupTasks, from, to));
            row.put("alertCount", countInRange(groupAlerts, from, to).size());
            rows.add(row);
        }
        rows.sort((a, b) -> Integer.compare((Integer) b.get("farmCount"), (Integer) a.get("farmCount")));
        return rows;
    }

    @Override
    public List<Map<String, Object>> rank(int limit) {
        int top = limit > 0 ? limit : 10;
        List<Farm> farms = farmMapper.selectList(new LambdaQueryWrapper<>());
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<>());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Farm farm : farms) {
            long plotCount = plots.stream().filter(p -> farm.getId().equals(p.getFarmId())).count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("farmId", farm.getId() == null ? null : String.valueOf(farm.getId()));
            row.put("farmName", farm.getFarmName());
            row.put("areaTotal", farm.getTotalArea() == null ? BigDecimal.ZERO : farm.getTotalArea());
            row.put("plotCount", plotCount);
            rows.add(row);
        }
        // 面积降序；面积相同按地块数降序（否则顺序不稳定，页面上的 TOP10 会随机跳）
        rows.sort(Comparator
                .comparing((Map<String, Object> row) -> (BigDecimal) row.get("areaTotal")).reversed()
                .thenComparing(row -> (Long) row.get("plotCount"), Comparator.reverseOrder()));
        return rows.size() > top ? rows.subList(0, top) : rows;
    }

    @Override
    public List<Map<String, Object>> regionDistribution(String startDate, String endDate) {
        LocalDate from = parseDate(startDate);
        LocalDate to = parseDate(endDate);
        List<Farm> farms = farmMapper.selectList(new LambdaQueryWrapper<>());
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<>());
        List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<>());

        Map<String, List<Farm>> byRegion = farms.stream()
                .collect(Collectors.groupingBy(this::regionOf, LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, List<Farm>> entry : byRegion.entrySet()) {
            Set<Long> farmIds = entry.getValue().stream().map(Farm::getId).collect(Collectors.toSet());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("region", entry.getKey());
            row.put("farmCount", farmIds.size());
            row.put("fieldArea", sumArea(plots.stream().filter(p -> farmIds.contains(p.getFarmId())).toList()));
            row.put("tenantCount", entry.getValue().stream().map(Farm::getTenantId).distinct().count());
            row.put("activityLevel", activityLevel(farmIds.size()));
            // 告警数一并给出：页面当前没读，但"区域分布"没有活跃度以外的时间维度，
            // 留一个能让区间筛选生效的数，比让 startDate/endDate 静默失效要好
            row.put("alertCount", countInRange(alerts.stream()
                    .filter(a -> farmIds.contains(a.getFarmId())).toList(), from, to).size());
            rows.add(row);
        }
        rows.sort((a, b) -> Integer.compare((Integer) b.get("farmCount"), (Integer) a.get("farmCount")));
        return rows;
    }

    @Override
    public Map<String, Object> alertTrend() {
        List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<>());
        Map<String, Object> result = new LinkedHashMap<>();
        for (AlertRecord alert : alerts) {
            String level = alert.getLevel() == null || alert.getLevel().isBlank() ? "unknown" : alert.getLevel();
            result.put(level, ((Number) result.getOrDefault(level, 0)).intValue() + 1);
        }
        return result;
    }

    @Override
    public List<Map<String, Object>> trend(String startDate, String endDate) {
        LocalDate to = parseDate(endDate) != null ? parseDate(endDate) : LocalDate.now();
        LocalDate from = parseDate(startDate) != null ? parseDate(startDate) : to.minusDays(6);
        List<Task> tasks = taskMapper.selectList(new LambdaQueryWrapper<>());
        List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<>());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            LocalDate current = day;
            List<Task> dayTasks = tasks.stream()
                    .filter(task -> task.getPlanStartTime() != null
                            && task.getPlanStartTime().toLocalDate().equals(current))
                    .toList();
            long done = dayTasks.stream().filter(task -> "completed".equalsIgnoreCase(task.getStatus())).count();
            long workers = dayTasks.stream()
                    .map(Task::getExecutorName)
                    .filter(name -> name != null && !name.isBlank())
                    .distinct().count();
            long alertCount = alerts.stream()
                    .filter(alert -> alert.getCreateTime() != null
                            && alert.getCreateTime().toLocalDate().equals(current))
                    .count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("label", DAY.format(day));
            row.put("taskRate", dayTasks.isEmpty() ? 0 : (int) (done * 100 / dayTasks.size()));
            row.put("activeWorkers", workers);
            row.put("alertCount", alertCount);
            rows.add(row);
        }
        return rows;
    }

    /** 区域：优先省，其次市，都没有就归到"未标注区域"（不臆断一个省名） */
    private String regionOf(Farm farm) {
        if (farm.getProvince() != null && !farm.getProvince().isBlank()) {
            return farm.getProvince().trim();
        }
        if (farm.getCity() != null && !farm.getCity().isBlank()) {
            return farm.getCity().trim();
        }
        return "未标注区域";
    }

    /** 活跃度分层：约定 —— 农场数 ≥3 高 / =2 中 / 其余低（不是后端原有指标，页面注释里也按此解释） */
    private static String activityLevel(int farmCount) {
        if (farmCount >= 3) {
            return "high";
        }
        return farmCount == 2 ? "middle" : "low";
    }

    private static BigDecimal sumArea(List<Plot> plots) {
        return plots.stream()
                .map(Plot::getArea)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** 采收量（吨）：库里是 kg，÷1000 保留 1 位；按 harvest_date 落区间 */
    private static BigDecimal harvestTon(List<HarvestBatch> batches, LocalDate from, LocalDate to) {
        BigDecimal kg = batches.stream()
                .filter(batch -> inRange(batch.getHarvestDate(), from, to))
                .map(HarvestBatch::getQuantity)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return kg.divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_UP);
    }

    /** 任务完成率（%）：已完成的 ÷ 全部（按 plan_end_time 落区间） */
    private static int taskRate(List<Task> tasks, LocalDate from, LocalDate to) {
        List<Task> scoped = tasks.stream()
                .filter(task -> from == null && to == null
                        || inRange(task.getPlanEndTime() == null ? null : task.getPlanEndTime().toLocalDate(), from, to))
                .toList();
        if (scoped.isEmpty()) {
            return 0;
        }
        long done = scoped.stream().filter(task -> "completed".equalsIgnoreCase(task.getStatus())).count();
        return (int) (done * 100 / scoped.size());
    }

    private static List<AlertRecord> countInRange(List<AlertRecord> alerts, LocalDate from, LocalDate to) {
        return alerts.stream()
                .filter(alert -> inRange(alert.getCreateTime() == null ? null
                        : alert.getCreateTime().toLocalDate(), from, to))
                .toList();
    }

    private static boolean inRange(LocalDate date, LocalDate from, LocalDate to) {
        if (date == null) {
            return from == null && to == null;
        }
        if (from != null && date.isBefore(from)) {
            return false;
        }
        return to == null || !date.isAfter(to);
    }

    /** 解析 yyyy-MM-dd；传了但不合法时记一条 WARN 并按"不筛"处理（不让筛选静默失效变成静默报错） */
    private static LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim().substring(0, Math.min(10, text.trim().length())));
        } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            log.warn("仪表盘日期参数无法解析，已按不筛选处理：{}", text);
            return null;
        }
    }
}
