package com.agri.production.service.impl;

import com.agri.production.common.constant.AlertDict;
import com.agri.production.common.constant.PlanStatusDict;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Plot;
import com.agri.production.entity.ProductionReport;
import com.agri.production.entity.ReportSubscription;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.InputUsageRecordMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.ProductionReportMapper;
import com.agri.production.mapper.ReportSubscriptionMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.IReportAnalyticsService;
import com.agri.production.vo.DimensionPointVO;
import com.agri.production.vo.MetricTrendPointVO;
import com.agri.production.vo.ReportSubscriptionVO;
import com.agri.production.vo.ReportVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 数据分析与报表实现。
 *
 * <p>聚合口径的原则（对齐项目纪律）：**能从已有表算出来的就算，算不出来的一律留空**，
 * 不用 0 或示例值顶替。本部署确实缺数据源的项（成本 / 产值 / 生成人）在对应出参的
 * 类注释里逐条写清了原因。</p>
 */
@Slf4j
@Service
public class ReportAnalyticsServiceImpl implements IReportAnalyticsService {

    /** 任务"已完成"的口径：与前端 isTaskDone 一致（completed 为主线，done 是迁移前的旧值）。 */
    private static final List<String> TASK_DONE = List.of("completed", "done");
    /** 任务"进行中/待处理"的口径。 */
    private static final List<String> TASK_OPEN = List.of("pending", "assigned", "executing", "doing");
    /** 检测合格的口径。 */
    private static final List<String> INSPECTION_PASS = List.of("PASS", "pass", "OK", "ok", "QUALIFIED");
    /** 设备在线口径。 */
    private static final List<String> DEVICE_ONLINE = List.of("online", "ONLINE", "1");
    /** 订阅周期白名单（页面下拉的四项）。 */
    private static final List<String> SUBSCRIBE_PERIODS = List.of("daily", "weekly", "monthly", "quarterly");
    /** 支持的指标码（趋势端点）。 */
    private static final List<String> METRIC_CODES = List.of("YIELD", "PASS_RATE");
    /** 报表导出目录（相对服务的工作目录，即 agri-production/backend —— 与方案文档口径一致，不引入对象存储）。 */
    private static final Path EXPORT_DIR = Paths.get("target", "exports");
    private static final int REPORT_TYPE_MIN = 1;
    private static final int REPORT_TYPE_MAX = 5;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final HarvestBatchMapper harvestBatchMapper;
    private final TaskMapper taskMapper;
    private final InspectionMapper inspectionMapper;
    private final InputUsageRecordMapper inputUsageMapper;
    private final AlertRecordMapper alertMapper;
    private final IoTDeviceMapper deviceMapper;
    private final TraceCodeMapper traceCodeMapper;
    private final PlotMapper plotMapper;
    private final FarmMapper farmMapper;
    private final PlantingPlanMapper planMapper;
    private final ProductionReportMapper reportMapper;
    private final ReportSubscriptionMapper subscriptionMapper;

    public ReportAnalyticsServiceImpl(HarvestBatchMapper harvestBatchMapper, TaskMapper taskMapper,
                                      InspectionMapper inspectionMapper, InputUsageRecordMapper inputUsageMapper,
                                      AlertRecordMapper alertMapper, IoTDeviceMapper deviceMapper,
                                      TraceCodeMapper traceCodeMapper, PlotMapper plotMapper, FarmMapper farmMapper,
                                      PlantingPlanMapper planMapper, ProductionReportMapper reportMapper,
                                      ReportSubscriptionMapper subscriptionMapper) {
        this.harvestBatchMapper = harvestBatchMapper;
        this.taskMapper = taskMapper;
        this.inspectionMapper = inspectionMapper;
        this.inputUsageMapper = inputUsageMapper;
        this.alertMapper = alertMapper;
        this.deviceMapper = deviceMapper;
        this.traceCodeMapper = traceCodeMapper;
        this.plotMapper = plotMapper;
        this.farmMapper = farmMapper;
        this.planMapper = planMapper;
        this.reportMapper = reportMapper;
        this.subscriptionMapper = subscriptionMapper;
    }

    /* ==================== 看板指标 ==================== */

    @Override
    public Map<String, Object> dashboard(String tenantId, Long farmId, String startDate, String endDate) {
        requireTenant(tenantId);
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("yieldTotal", sumHarvestQty(tenantId, farmId, null, null));
        result.put("monthHarvestQty", sumHarvestQty(tenantId, farmId, monthStart, monthEnd));
        result.put("passRate", passRate(tenantId, farmId, null, null));
        result.put("farmCount", farmCount(tenantId, farmId));
        result.put("plotCount", plotCount(tenantId, farmId));
        result.put("plantingArea", plantingArea(tenantId, farmId));
        result.put("cropCount", cropCount(tenantId, farmId));
        result.put("runningPlanCount", runningPlanCount(tenantId, farmId));
        result.put("pendingTaskCount", countTask(tenantId, farmId, TASK_OPEN, null, null));
        result.put("monthTaskTotal", countTask(tenantId, farmId, null, monthStart, monthEnd));
        result.put("monthTaskDone", countTask(tenantId, farmId, TASK_DONE, monthStart, monthEnd));
        BigDecimal monthTotal = toDecimal(result.get("monthTaskTotal"));
        BigDecimal monthDone = toDecimal(result.get("monthTaskDone"));
        result.put("taskCompletionRate", monthTotal.signum() == 0 ? null
                : monthDone.multiply(BigDecimal.valueOf(100))
                        .divide(monthTotal, 1, RoundingMode.HALF_UP));
        result.put("alertCount", pendingAlertCount(tenantId, farmId));
        result.put("activeDeviceCount", onlineDeviceCount(tenantId, farmId));
        result.put("traceCodeCount", traceCodeCount(tenantId, farmId));
        // 已接入且有值的指标条数：页面用它判断"接口是否真的给了东西"，不参与展示口径
        result.put("metricCount", result.values().stream().filter(java.util.Objects::nonNull).count());
        result.put("avgCostPerMu", null);
        result.put("window", window(startDate, endDate, List.of("trend", "dimension")));
        return result;
    }

    /**
     * 区间回显：让"这个区间到底作用在哪几条端点上"在响应里看得见。
     *
     * <p>页面的看板卡片带自带口径（累计 / 本月），不按用户在右上角选的窗口裁剪 ——
     * 静默忽略一个传进来的参数是这轮一直在治的毛病，所以这里把它显式回显出来。</p>
     */
    private Map<String, Object> window(String startDate, String endDate, List<String> appliedTo) {
        Map<String, Object> window = new LinkedHashMap<>();
        window.put("startDate", blankToNull(startDate));
        window.put("endDate", blankToNull(endDate));
        window.put("appliedTo", appliedTo);
        window.put("note", "看板卡片按各自标签口径统计（累计=全量、本月=自然月），不随窗口裁剪");
        return window;
    }

    /* ==================== 维度分析 ==================== */

    @Override
    public List<DimensionPointVO> dimension(String tenantId, Long farmId, String dimension,
                                           String startDate, String endDate) {
        requireTenant(tenantId);
        String dim = dimension == null || dimension.isBlank() ? "crop" : dimension.trim().toLowerCase(Locale.ROOT);
        if (!List.of("crop", "plot", "month").contains(dim)) {
            throw new BusinessException(400, "维度只支持 crop（按作物）/ plot（按地块）/ month（按时间）：" + dimension);
        }
        LocalDate from = parseDate(startDate, "startDate");
        LocalDate to = parseDate(endDate, "endDate");

        // 产量：采收批次按 harvest_date 落在区间内聚合；任务：按 plan_start_time 落区间。
        QueryWrapper<HarvestBatch> harvest = new QueryWrapper<>();
        harvest.eq("tenant_id", tenantId);
        if (farmId != null) {
            harvest.eq("farm_id", farmId);
        }
        if (from != null) {
            harvest.ge("harvest_date", from);
        }
        if (to != null) {
            harvest.le("harvest_date", to);
        }
        List<HarvestBatch> batches = harvestBatchMapper.selectList(harvest);
        List<Task> tasks = tasksInRange(tenantId, farmId, from, to);
        Map<Long, Plot> plots = plotsById(tenantId, batches);
        // 任务里出现的地块也要能解析出名字（否则"按地块"维度里会同时出现"1"和"A区-地块1"两行）
        for (Task task : tasks) {
            if (task.getPlotId() != null && !plots.containsKey(task.getPlotId())) {
                Plot plot = plotMapper.selectById(task.getPlotId());
                if (plot != null && tenantId.equals(plot.getTenantId())) {
                    plots.put(plot.getId(), plot);
                }
            }
        }
        // 面积去重用的"已计入的地块"标记：**局部变量**，不能做成实例字段 ——
        // 本类是单例，实例字段会被并发请求共享，A 请求的面积会串到 B 请求里。
        Map<String, java.util.Set<Long>> countedPlots = new LinkedHashMap<>();

        Map<String, DimensionPointVO> grouped = new LinkedHashMap<>();
        for (HarvestBatch batch : batches) {
            String name = switch (dim) {
                case "plot" -> plotLabel(batch.getPlotId(), plots);
                case "month" -> batch.getHarvestDate() == null ? "未标注日期"
                        : batch.getHarvestDate().format(DateTimeFormatter.ofPattern("yyyy-MM"));
                default -> blankToNull(batch.getCropName()) == null ? "未标注作物" : batch.getCropName().trim();
            };
            DimensionPointVO point = grouped.computeIfAbsent(name, key -> newPoint(key));
            point.setYieldQty(nullToZero(point.getYieldQty()).add(nullToZero(batch.getQuantity())));
            // 面积：按"这批采收涉及的地块面积"累加。同一地块在一个维度里只算一次 ——
            // 直接累加会把 8.5 亩的地块因三批采收算成 25.5 亩（面积不是可加的流量指标）。
            Plot plot = batch.getPlotId() == null ? null : plots.get(batch.getPlotId());
            if (plot != null && plot.getArea() != null) {
                java.util.Set<Long> seen = countedPlots.computeIfAbsent(name, key -> new java.util.HashSet<>());
                if (seen.add(plot.getId())) {
                    point.setAreaMu(nullToZero(point.getAreaMu()).add(plot.getArea()));
                }
            }
        }
        for (Task task : tasks) {
            String name = switch (dim) {
                case "plot" -> task.getPlotId() == null ? "未标注地块" : plotLabel(task.getPlotId(), plots);
                case "month" -> task.getPlanStartTime() == null ? "未标注日期"
                        : task.getPlanStartTime().format(DateTimeFormatter.ofPattern("yyyy-MM"));
                default -> blankToNull(task.getCropName()) == null ? "未标注作物" : task.getCropName().trim();
            };
            DimensionPointVO point = grouped.computeIfAbsent(name, key -> newPoint(key));
            point.setTaskCount(point.getTaskCount() + 1);
            if (isDone(task.getStatus())) {
                point.setDoneCount(point.getDoneCount() + 1);
            }
        }
        List<DimensionPointVO> result = new ArrayList<>(grouped.values());
        result.sort(Comparator.comparing(DimensionPointVO::getName));
        return result;
    }

    /** 新维度点：成本/产值没有数据源，恒为 null（原因见 {@link DimensionPointVO} 注释）。 */
    private static DimensionPointVO newPoint(String name) {
        DimensionPointVO point = new DimensionPointVO();
        point.setName(name);
        point.setYieldQty(BigDecimal.ZERO);
        point.setAreaMu(null);
        point.setInputCost(null);
        point.setOutputValue(null);
        return point;
    }

    /* ==================== 指标趋势 ==================== */

    @Override
    public List<MetricTrendPointVO> trend(String tenantId, Long farmId, String metricCode,
                                         String startDate, String endDate) {
        requireTenant(tenantId);
        // 页面只调 YIELD；缺省按 YIELD 处理（前端 production-view 的用法就是这个）
        String code = metricCode == null || metricCode.isBlank() ? "YIELD" : metricCode.trim().toUpperCase(Locale.ROOT);
        if (!METRIC_CODES.contains(code)) {
            // 认不出的指标码**报错而不是返回空数组**：空数组会被页面显示成"该指标暂无数据"，
            // 而真实原因是"这个指标码本服务不认识"——两件事混在一起会让排查从第一步就走错方向。
            throw new BusinessException(400, "未知指标码：" + metricCode + "（本服务支持 " + METRIC_CODES + "）");
        }
        LocalDate from = parseDate(startDate, "startDate");
        LocalDate to = parseDate(endDate, "endDate");
        List<MetricTrendPointVO> points = new ArrayList<>();
        if ("YIELD".equals(code)) {
            QueryWrapper<HarvestBatch> w = new QueryWrapper<>();
            w.select("harvest_date AS bizDate", "IFNULL(SUM(quantity), 0) AS metricValue")
                    .eq("tenant_id", tenantId);
            if (farmId != null) {
                w.eq("farm_id", farmId);
            }
            if (from != null) {
                w.ge("harvest_date", from);
            }
            if (to != null) {
                w.le("harvest_date", to);
            }
            w.isNotNull("harvest_date").groupBy("harvest_date").orderByAsc("harvest_date");
            for (Map<String, Object> row : harvestBatchMapper.selectMaps(w)) {
                points.add(point(row.get("bizDate"), row.get("metricValue"), code));
            }
        } else {
            QueryWrapper<com.agri.production.entity.Inspection> w = new QueryWrapper<>();
            w.select("DATE(sample_at) AS bizDate", "COUNT(*) AS totalCount",
                    "SUM(CASE WHEN UPPER(TRIM(result)) = 'PASS' THEN 1 ELSE 0 END) AS passCount")
                    .eq("tenant_id", tenantId)
                    .isNotNull("sample_at")
                    .isNotNull("result");
            if (farmId != null) {
                w.eq("farm_id", farmId);
            }
            if (from != null) {
                w.ge("sample_at", from.atStartOfDay());
            }
            if (to != null) {
                w.lt("sample_at", to.plusDays(1).atStartOfDay());
            }
            w.groupBy("DATE(sample_at)").orderByAsc("DATE(sample_at)");
            for (Map<String, Object> row : inspectionMapper.selectMaps(w)) {
                BigDecimal total = toDecimal(row.get("totalCount"));
                BigDecimal pass = toDecimal(row.get("passCount"));
                BigDecimal rate = total.signum() == 0 ? null
                        : pass.multiply(BigDecimal.valueOf(100)).divide(total, 1, RoundingMode.HALF_UP);
                points.add(point(row.get("bizDate"), rate, code));
            }
        }
        return points;
    }

    private static MetricTrendPointVO point(Object date, Object value, String code) {
        MetricTrendPointVO vo = new MetricTrendPointVO();
        vo.setBizDate(date == null ? null : String.valueOf(date).substring(0, 10));
        vo.setMetricValue(toDecimal(value));
        vo.setMetricCode(code);
        return vo;
    }

    /* ==================== 报表：列表 / 生成 / 导出 / 删除 ==================== */

    @Override
    public PageResult<ReportVO> pageReports(String tenantId, int pageNum, int pageSize,
                                            Integer reportType, String period) {
        requireTenant(tenantId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<ProductionReport> w = new LambdaQueryWrapper<ProductionReport>()
                .eq(ProductionReport::getTenantId, tenantId);
        if (reportType != null) {
            w.eq(ProductionReport::getReportType, reportType);
        }
        String keyword = blankToNull(period);
        if (keyword != null) {
            // 参数名沿用页面：页面把列表页的关键字输入框塞进了 period 参数（见 ProductionReports.tsx），
            // 服务端按"报表名或周期标签"模糊匹配，与页面本地过滤的口径一致。
            w.and(q -> q.like(ProductionReport::getReportName, keyword)
                    .or().like(ProductionReport::getPeriod, keyword));
        }
        w.orderByDesc(ProductionReport::getGeneratedAt).orderByDesc(ProductionReport::getReportId);
        Page<ProductionReport> result = reportMapper.selectPage(new Page<>(p, s), w);
        List<ReportVO> rows = result.getRecords().stream().map(ReportVO::of).toList();
        return PageResult.of(rows, result.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReportVO generate(String tenantId, Long farmId, Integer reportType, String period, String generatedBy) {
        requireTenant(tenantId);
        if (reportType == null || reportType < REPORT_TYPE_MIN || reportType > REPORT_TYPE_MAX) {
            throw new BusinessException(400, "报表类型应为 1 日报 / 2 周报 / 3 月报 / 4 季报 / 5 年报：" + reportType);
        }
        LocalDate anchor = parseDate(period, "period");
        if (anchor == null) {
            throw new BusinessException(400, "缺少统计周期（period 为区间起始日期 yyyy-MM-dd）");
        }
        Window window = windowOf(reportType, anchor);

        Map<String, Object> metrics = snapshotMetrics(tenantId, farmId, window);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("reportType", reportType);
        summary.put("period", window.label);
        summary.put("periodStart", window.start.format(DATE));
        summary.put("periodEnd", window.end.format(DATE));
        summary.put("farmId", farmId);
        summary.put("generatedAt", DATETIME.format(LocalDateTime.now()));
        summary.put("metrics", metrics);

        ProductionReport report = new ProductionReport();
        report.setReportId("RPT" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        report.setReportName(typeLabel(reportType) + " · " + window.label);
        report.setReportType(reportType);
        report.setPeriod(window.label);
        report.setPeriodStart(window.start);
        report.setPeriodEnd(window.end);
        // 即时聚合、当场可读，所以落库就是"已完成"。做成异步要配任务表与轮询，
        // 而这个模块连消息通道都没有 —— 与其假装异步，不如让数据立刻可用。
        report.setStatus(2);
        report.setSummaryJson(writeJson(summary));
        report.setDownloadKey(UUID.randomUUID().toString().replace("-", ""));
        report.setGeneratedAt(LocalDateTime.now());
        report.setGeneratedBy(blankToNull(generatedBy));
        report.setRemark("由报告中心即时聚合生成（任务 / 采收 / 投入品 / 检测 / 告警）");
        report.setTenantId(tenantId);
        report.setFarmId(farmId);
        report.setFileUrl(fileUrlOf(report.getReportId(), report.getDownloadKey()));
        reportMapper.insert(report);
        log.info("报表生成：{}（{} / {}）", report.getReportId(), report.getReportName(), window.label);
        return ReportVO.of(report);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> export(String tenantId, String reportId) {
        ProductionReport report = requireReport(tenantId, reportId);
        if (blankToNull(report.getDownloadKey()) == null) {
            report.setDownloadKey(UUID.randomUUID().toString().replace("-", ""));
        }
        if (blankToNull(report.getFileUrl()) == null) {
            report.setFileUrl(fileUrlOf(report.getReportId(), report.getDownloadKey()));
        }
        Path file = writeCsv(report);
        report.setFileSize((long) file.toFile().length());
        reportMapper.updateById(report);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileUrl", report.getFileUrl());
        result.put("fileSize", report.getFileSize());
        result.put("fileName", report.getReportName() + ".csv");
        result.put("storedAt", file.toAbsolutePath().toString());
        // 页面拿到 fileUrl 后会 window.open 直接下载；文件同时落盘在 target/exports（方案文档口径，不引入对象存储）
        result.put("note", "文件已生成在服务端 target/exports，fileUrl 指向本服务的下载端点");
        return result;
    }

    @Override
    public ReportFile download(String reportId, String key) {
        if (blankToNull(reportId) == null) {
            throw new BusinessException(400, "缺少报表编号");
        }
        ProductionReport report = reportMapper.selectOne(new LambdaQueryWrapper<ProductionReport>()
                .eq(ProductionReport::getReportId, reportId.trim())
                .last("LIMIT 1"));
        if (report == null) {
            throw new BusinessException(404, "报表不存在：" + reportId.trim());
        }
        // 下载端点刻意不校验平台令牌（window.open 带不了 Authorization 头），改用报表自带的下载令牌。
        // 令牌是随机 32 位、只在"生成/导出"时随 fileUrl 一起给到已认证的调用方。
        // 令牌不对时按本服务的统一口径返回 body 里的业务码（HTTP 200 + code=403/404）——
        // 浏览器打开时看到的是一段 JSON 而不是文件，这是"下载失败"最直白的表现。
        if (blankToNull(key) == null || !key.trim().equals(report.getDownloadKey())) {
            throw new BusinessException(403, "下载令牌无效，请回到报表列表重新导出");
        }
        Path file = writeCsv(report);
        try {
            return new ReportFile(report.getReportName() + ".csv", Files.readAllBytes(file));
        } catch (IOException e) {
            throw new BusinessException(500, "报表文件读取失败：" + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteReport(String tenantId, String reportId) {
        ProductionReport report = requireReport(tenantId, reportId);
        reportMapper.deleteById(report.getId());
        log.info("报表删除：{}", report.getReportId());
    }

    /* ==================== 报表订阅 ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReportSubscriptionVO subscribe(String tenantId, Long farmId, SubscriptionPayload payload) {
        requireTenant(tenantId);
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        if (payload.reportType() == null || payload.reportType() < REPORT_TYPE_MIN
                || payload.reportType() > REPORT_TYPE_MAX) {
            throw new BusinessException(400, "报表类型应为 1~5：" + payload.reportType());
        }
        String period = blankToNull(payload.period());
        if (period == null || !SUBSCRIBE_PERIODS.contains(period.toLowerCase(Locale.ROOT))) {
            throw new BusinessException(400, "订阅周期应为 daily / weekly / monthly / quarterly：" + payload.period());
        }
        if (payload.receivers() == null || payload.receivers().isEmpty()) {
            throw new BusinessException(400, "接收人不能为空");
        }
        Integer status = payload.status() == null ? 1 : payload.status();
        if (status != 0 && status != 1) {
            throw new BusinessException(400, "订阅状态应为 1 启用 / 0 停用：" + status);
        }
        ReportSubscription entity = new ReportSubscription();
        entity.setSubscribeId("SUB" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        entity.setReportType(payload.reportType());
        entity.setPeriod(period.toLowerCase(Locale.ROOT));
        entity.setChannels(writeJson(payload.channels() == null ? List.of() : payload.channels()));
        entity.setReceivers(writeJson(payload.receivers()));
        entity.setStatus(status);
        // 本部署没有消息通道：last_pushed_at 留空，响应里带 delivery = not-configured。
        entity.setLastPushedAt(null);
        entity.setTenantId(tenantId);
        entity.setFarmId(farmId);
        subscriptionMapper.insert(entity);
        log.info("报表订阅新增：{}（类型 {} / 周期 {} / 接收人 {}）",
                entity.getSubscribeId(), entity.getReportType(), entity.getPeriod(), entity.getReceivers());
        return ReportSubscriptionVO.of(entity);
    }

    @Override
    public List<ReportSubscriptionVO> listSubscriptions(String tenantId) {
        requireTenant(tenantId);
        List<ReportSubscription> rows = subscriptionMapper.selectList(new LambdaQueryWrapper<ReportSubscription>()
                .eq(ReportSubscription::getTenantId, tenantId)
                .orderByDesc(ReportSubscription::getUpdateTime)
                .orderByDesc(ReportSubscription::getSubscribeId));
        return rows.stream().map(ReportSubscriptionVO::of).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void unsubscribe(String tenantId, String subscribeId) {
        requireTenant(tenantId);
        if (blankToNull(subscribeId) == null) {
            throw new BusinessException(400, "缺少订阅编号");
        }
        ReportSubscription entity = subscriptionMapper.selectOne(new LambdaQueryWrapper<ReportSubscription>()
                .eq(ReportSubscription::getTenantId, tenantId)
                .eq(ReportSubscription::getSubscribeId, subscribeId.trim())
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(404, "订阅不存在：" + subscribeId.trim());
        }
        subscriptionMapper.deleteById(entity.getId());
    }

    /* ==================== 内部工具：聚合 ==================== */

    /**
     * 报表快照的指标集合（全部来自现有表，缺数据源的项不编）。
     *
     * <p>口径说明：任务按 {@code plan_start_time} 归属区间；采收按 {@code harvest_date}；
     * 检测按 {@code sample_at} 且**只统计已有结论的**（result 非空）；投入品只统计使用记录条数
     * （不同单位不能相加：袋 + 瓶 没有意义）；告警按"未处理"（与告警段共用 AlertDict 的词表）。</p>
     */
    private Map<String, Object> snapshotMetrics(String tenantId, Long farmId, Window window) {
        LocalDate from = window.start;
        LocalDate to = window.end;
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("taskTotal", countTask(tenantId, farmId, null, from, to));
        metrics.put("taskDone", countTask(tenantId, farmId, TASK_DONE, from, to));
        metrics.put("taskOpen", countTask(tenantId, farmId, TASK_OPEN, from, to));
        metrics.put("harvestBatchCount", countHarvest(tenantId, farmId, from, to));
        metrics.put("harvestQty", sumHarvestQty(tenantId, farmId, from, to));
        metrics.put("harvestGradeA", countHarvestGrade(tenantId, farmId, from, to, "A"));
        metrics.put("harvestGradeB", countHarvestGrade(tenantId, farmId, from, to, "B"));
        metrics.put("harvestGradeC", countHarvestGrade(tenantId, farmId, from, to, "C"));
        metrics.put("inputUsageCount", countInputUsage(tenantId, farmId, from, to));
        metrics.put("inspectionFinished", countInspection(tenantId, farmId, from, to, true));
        metrics.put("inspectionPassed", countInspectionPassed(tenantId, farmId, from, to));
        metrics.put("inspectionPassRate", passRate(tenantId, farmId, from, to));
        metrics.put("alertPending", pendingAlertCount(tenantId, farmId));
        return metrics;
    }

    /** 采收量合计（kg）—— 没有区间时是"累计"，有区间时是"区间内"。 */
    private BigDecimal sumHarvestQty(String tenantId, Long farmId, LocalDate from, LocalDate to) {
        QueryWrapper<HarvestBatch> w = new QueryWrapper<>();
        w.select("IFNULL(SUM(quantity), 0) AS qty").eq("tenant_id", tenantId);
        if (farmId != null) {
            w.eq("farm_id", farmId);
        }
        if (from != null) {
            w.ge("harvest_date", from);
        }
        if (to != null) {
            w.le("harvest_date", to);
        }
        return toDecimal(firstValue(harvestBatchMapper.selectMaps(w), "qty"));
    }

    private long countHarvest(String tenantId, Long farmId, LocalDate from, LocalDate to) {
        QueryWrapper<HarvestBatch> w = new QueryWrapper<>();
        w.eq("tenant_id", tenantId);
        if (farmId != null) {
            w.eq("farm_id", farmId);
        }
        if (from != null) {
            w.ge("harvest_date", from);
        }
        if (to != null) {
            w.le("harvest_date", to);
        }
        return harvestBatchMapper.selectCount(w);
    }

    private long countHarvestGrade(String tenantId, Long farmId, LocalDate from, LocalDate to, String grade) {
        QueryWrapper<HarvestBatch> w = new QueryWrapper<>();
        w.eq("tenant_id", tenantId).eq("grade", grade);
        if (farmId != null) {
            w.eq("farm_id", farmId);
        }
        if (from != null) {
            w.ge("harvest_date", from);
        }
        if (to != null) {
            w.le("harvest_date", to);
        }
        return harvestBatchMapper.selectCount(w);
    }

    private long countInputUsage(String tenantId, Long farmId, LocalDate from, LocalDate to) {
        QueryWrapper<com.agri.production.entity.InputUsageRecord> w = new QueryWrapper<>();
        w.eq("tenant_id", tenantId);
        if (farmId != null) {
            w.eq("farm_id", farmId);
        }
        if (from != null) {
            w.ge("used_at", from.atStartOfDay());
        }
        if (to != null) {
            w.lt("used_at", to.plusDays(1).atStartOfDay());
        }
        return inputUsageMapper.selectCount(w);
    }

    private long countInspection(String tenantId, Long farmId, LocalDate from, LocalDate to, boolean finishedOnly) {
        QueryWrapper<com.agri.production.entity.Inspection> w = new QueryWrapper<>();
        w.eq("tenant_id", tenantId);
        if (finishedOnly) {
            w.isNotNull("result");
        }
        if (farmId != null) {
            w.eq("farm_id", farmId);
        }
        if (from != null) {
            w.ge("sample_at", from.atStartOfDay());
        }
        if (to != null) {
            w.lt("sample_at", to.plusDays(1).atStartOfDay());
        }
        return inspectionMapper.selectCount(w);
    }

    private long countInspectionPassed(String tenantId, Long farmId, LocalDate from, LocalDate to) {
        QueryWrapper<com.agri.production.entity.Inspection> w = new QueryWrapper<>();
        w.eq("tenant_id", tenantId).in("result", INSPECTION_PASS);
        if (farmId != null) {
            w.eq("farm_id", farmId);
        }
        if (from != null) {
            w.ge("sample_at", from.atStartOfDay());
        }
        if (to != null) {
            w.lt("sample_at", to.plusDays(1).atStartOfDay());
        }
        return inspectionMapper.selectCount(w);
    }

    /**
     * 检测合格率（%）。
     *
     * <p>分母是**已有结论的检测数**（result 非空），而不是全部送检数 ——
     * 还在检测中的单子既不算合格也不算不合格，把它算进分母会让合格率凭空变低，
     * 而页面上看不出这是"还没出结果"造成的。没有任何已出结论的检测时返回 null（页面显示 —）。</p>
     */
    private BigDecimal passRate(String tenantId, Long farmId, LocalDate from, LocalDate to) {
        long total = countInspection(tenantId, farmId, from, to, true);
        if (total == 0) {
            return null;
        }
        long pass = countInspectionPassed(tenantId, farmId, from, to);
        return BigDecimal.valueOf(pass).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    /** 任务计数：statuses 为空表示不按状态过滤；区间按 plan_start_time（计划开始时间）。 */
    private long countTask(String tenantId, Long farmId, List<String> statuses, LocalDate from, LocalDate to) {
        LambdaQueryWrapper<Task> w = new LambdaQueryWrapper<Task>().eq(Task::getTenantId, tenantId);
        if (farmId != null) {
            w.eq(Task::getFarmId, farmId);
        }
        if (statuses != null && !statuses.isEmpty()) {
            w.in(Task::getStatus, statuses);
        }
        if (from != null) {
            w.ge(Task::getPlanStartTime, from.atStartOfDay());
        }
        if (to != null) {
            w.lt(Task::getPlanStartTime, to.plusDays(1).atStartOfDay());
        }
        return taskMapper.selectCount(w);
    }

    private List<Task> tasksInRange(String tenantId, Long farmId, LocalDate from, LocalDate to) {
        LambdaQueryWrapper<Task> w = new LambdaQueryWrapper<Task>().eq(Task::getTenantId, tenantId);
        if (farmId != null) {
            w.eq(Task::getFarmId, farmId);
        }
        if (from != null) {
            w.ge(Task::getPlanStartTime, from.atStartOfDay());
        }
        if (to != null) {
            w.lt(Task::getPlanStartTime, to.plusDays(1).atStartOfDay());
        }
        return taskMapper.selectList(w);
    }

    /** 未处理告警数：词表走 AlertDict（库内两代大小写写法并存，用 IN 才不会漏）。 */
    private long pendingAlertCount(String tenantId, Long farmId) {
        LambdaQueryWrapper<com.agri.production.entity.AlertRecord> w =
                new LambdaQueryWrapper<com.agri.production.entity.AlertRecord>()
                        .eq(com.agri.production.entity.AlertRecord::getTenantId, tenantId)
                        .in(com.agri.production.entity.AlertRecord::getStatus,
                                AlertDict.statusValuesOf(AlertDict.STATUS_PENDING));
        if (farmId != null) {
            w.eq(com.agri.production.entity.AlertRecord::getFarmId, farmId);
        }
        return alertMapper.selectCount(w);
    }

    private long onlineDeviceCount(String tenantId, Long farmId) {
        LambdaQueryWrapper<com.agri.production.entity.IoTDevice> w =
                new LambdaQueryWrapper<com.agri.production.entity.IoTDevice>()
                        .eq(com.agri.production.entity.IoTDevice::getTenantId, tenantId)
                        .in(com.agri.production.entity.IoTDevice::getStatus, DEVICE_ONLINE);
        if (farmId != null) {
            w.eq(com.agri.production.entity.IoTDevice::getFarmId, farmId);
        }
        return deviceMapper.selectCount(w);
    }

    private long traceCodeCount(String tenantId, Long farmId) {
        LambdaQueryWrapper<com.agri.production.entity.TraceCode> w =
                new LambdaQueryWrapper<com.agri.production.entity.TraceCode>()
                        .eq(com.agri.production.entity.TraceCode::getTenantId, tenantId);
        if (farmId != null) {
            w.eq(com.agri.production.entity.TraceCode::getFarmId, farmId);
        }
        return traceCodeMapper.selectCount(w);
    }

    private long farmCount(String tenantId, Long farmId) {
        LambdaQueryWrapper<com.agri.production.entity.Farm> w =
                new LambdaQueryWrapper<com.agri.production.entity.Farm>().eq(com.agri.production.entity.Farm::getTenantId, tenantId);
        if (farmId != null) {
            w.eq(com.agri.production.entity.Farm::getId, farmId);
        }
        return farmMapper.selectCount(w);
    }

    private List<Plot> activePlots(String tenantId, Long farmId) {
        LambdaQueryWrapper<Plot> w = new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId, tenantId)
                .in(Plot::getStatus, List.of("active", "ACTIVE", "1"));
        if (farmId != null) {
            w.eq(Plot::getFarmId, farmId);
        }
        return plotMapper.selectList(w);
    }

    private long plotCount(String tenantId, Long farmId) {
        LambdaQueryWrapper<Plot> w = new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId, tenantId);
        if (farmId != null) {
            w.eq(Plot::getFarmId, farmId);
        }
        return plotMapper.selectCount(w);
    }

    /** 在种面积（亩）：取状态为"在种/启用"的地块面积合计。 */
    private BigDecimal plantingArea(String tenantId, Long farmId) {
        BigDecimal sum = BigDecimal.ZERO;
        boolean any = false;
        for (Plot plot : activePlots(tenantId, farmId)) {
            if (plot.getArea() != null) {
                sum = sum.add(plot.getArea());
                any = true;
            }
        }
        // 一块地在种面积都没有时返回 null 而不是 0：0 亩是"确实没有在种面积"，
        // 而"地块的面积字段一个都没填"是另一回事（本部署演示数据曾经就是后者）。
        return any ? sum : null;
    }

    /** 在田作物种类数：在种地块上 current_crop 的去重个数。 */
    private long cropCount(String tenantId, Long farmId) {
        return activePlots(tenantId, farmId).stream()
                .map(Plot::getCurrentCrop)
                .filter(crop -> crop != null && !crop.isBlank())
                .map(String::trim)
                .distinct()
                .count();
    }

    /** 进行中计划数：plan_status ∈ (active, doing)（口径与 PlanStatusDict 一致）。 */
    private long runningPlanCount(String tenantId, Long farmId) {
        LambdaQueryWrapper<com.agri.production.entity.PlantingPlan> w =
                new LambdaQueryWrapper<com.agri.production.entity.PlantingPlan>()
                        .eq(com.agri.production.entity.PlantingPlan::getTenantId, tenantId)
                        .in(com.agri.production.entity.PlantingPlan::getPlanStatus,
                                List.of(PlanStatusDict.ACTIVE, "doing", "ACTIVE", "DOING"));
        if (farmId != null) {
            w.eq(com.agri.production.entity.PlantingPlan::getFarmId, farmId);
        }
        return planMapper.selectCount(w);
    }

    /* ==================== 内部工具：报表周期与文件 ==================== */

    /**
     * 报表统计区间。
     *
     * @param label 周期标签（日报 yyyy-MM-dd / 周报 yyyy-Www / 月报 yyyy-MM / 季报 yyyy-Qn / 年报 yyyy）
     * @param start 区间起（含）
     * @param end   区间止（含）
     */
    private record Window(String label, LocalDate start, LocalDate end) {
    }

    /**
     * 由「类型 + 锚点日期」推导统计区间。
     *
     * <p>页面生成报表时只传一个日期（所选区间的起始日）加一个类型，这里按类型把它展开成完整周期：
     * 日报=当天；周报=该日所在自然周（周一~周日，ISO 口径）；月报=该日所在自然月；
     * 季报=该日所在季度；年报=该日所在自然年。</p>
     */
    private static Window windowOf(int reportType, LocalDate anchor) {
        switch (reportType) {
            case 2: {
                LocalDate monday = anchor.with(DayOfWeek.MONDAY);
                int week = anchor.get(WeekFields.ISO.weekOfWeekBasedYear());
                return new Window(String.format("%d-W%02d", anchor.get(WeekFields.ISO.weekBasedYear()), week),
                        monday, monday.plusDays(6));
            }
            case 3: {
                LocalDate first = anchor.withDayOfMonth(1);
                return new Window(anchor.format(DateTimeFormatter.ofPattern("yyyy-MM")),
                        first, first.withDayOfMonth(first.lengthOfMonth()));
            }
            case 4: {
                int quarter = (anchor.getMonthValue() - 1) / 3 + 1;
                LocalDate first = LocalDate.of(anchor.getYear(), (quarter - 1) * 3 + 1, 1);
                return new Window(anchor.getYear() + "-Q" + quarter, first, first.plusMonths(3).minusDays(1));
            }
            case 5: {
                LocalDate first = LocalDate.of(anchor.getYear(), 1, 1);
                return new Window(String.valueOf(anchor.getYear()), first, LocalDate.of(anchor.getYear(), 12, 31));
            }
            default:
                return new Window(anchor.format(DATE), anchor, anchor);
        }
    }

    private static String typeLabel(int reportType) {
        return switch (reportType) {
            case 2 -> "生产周报";
            case 3 -> "生产月报";
            case 4 -> "生产季报";
            case 5 -> "生产年报";
            default -> "生产日报";
        };
    }

    /**
     * 导出地址。
     *
     * <p>指向本服务的下载端点并带上报表自带的下载令牌 —— 页面用 window.open 打开它，
     * 带不了 Authorization 头；把会话令牌拼进 URL 会进浏览器历史与访问日志，所以用独立令牌。</p>
     */
    private static String fileUrlOf(String reportId, String downloadKey) {
        return "/api/v1/production/analytics/reports/" + reportId + "/file?key=" + downloadKey;
    }

    /**
     * 把报表快照写成 CSV 文件（UTF-8 带 BOM，Excel 双击打开不乱码）。
     *
     * <p>文件落在 target/exports（方案文档口径：先落盘、以静态路径返回，不引入对象存储）。
     * 每次导出都按当前快照重写一遍：这样能修掉迁移/手工造成的脏文件，也免去"文件与快照谁过期了"的疑问。</p>
     */
    private Path writeCsv(ProductionReport report) {
        try {
            Files.createDirectories(EXPORT_DIR);
            Path file = EXPORT_DIR.resolve(report.getReportId() + ".csv");
            StringBuilder text = new StringBuilder();
            text.append('\uFEFF');
            text.append("报表名称,").append(csv(report.getReportName())).append('\n');
            text.append("统计周期,").append(csv(report.getPeriod())).append('\n');
            text.append("统计区间,")
                    .append(report.getPeriodStart() == null ? "" : DATE.format(report.getPeriodStart()))
                    .append(" ~ ")
                    .append(report.getPeriodEnd() == null ? "" : DATE.format(report.getPeriodEnd()))
                    .append('\n');
            text.append("生成时间,")
                    .append(report.getGeneratedAt() == null ? "" : DATETIME.format(report.getGeneratedAt()))
                    .append('\n');
            text.append("生成人,")
                    .append(csv(report.getGeneratedBy() == null ? "未接入（本服务暂不持有平台用户档案）" : report.getGeneratedBy()))
                    .append('\n');
            text.append("备注,").append(csv(report.getRemark())).append("\n\n");
            text.append("指标,值\n");
            for (Map.Entry<String, Object> entry : readMetrics(report.getSummaryJson()).entrySet()) {
                text.append(csv(entry.getKey())).append(',')
                        .append(entry.getValue() == null ? "" : csv(String.valueOf(entry.getValue()))).append('\n');
            }
            text.append("\n数据来源,本服务自有生产数据（任务 / 采收 / 投入品 / 检测 / 告警）\n");
            Files.writeString(file, text.toString(), StandardCharsets.UTF_8);
            return file;
        } catch (IOException e) {
            throw new BusinessException(500, "报表文件写入失败：" + e.getMessage());
        }
    }

    /** CSV 单元格转义：含逗号/引号/换行时用双引号包起来，内部引号翻倍。 */
    private static String csv(String raw) {
        String text = raw == null ? "" : raw;
        if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
            return '"' + text.replace("\"", "\"\"") + '"';
        }
        return text;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> readMetrics(String summaryJson) {
        if (summaryJson == null || summaryJson.isBlank()) {
            return Map.of();
        }
        try {
            Map<String, Object> summary = JSON.readValue(summaryJson, Map.class);
            Object metrics = summary.get("metrics");
            return metrics instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        } catch (Exception e) {
            log.warn("报表快照解析失败，导出只输出表头：{}", e.getMessage());
            return Map.of();
        }
    }

    private static String writeJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception e) {
            throw new BusinessException(500, "序列化失败：" + e.getMessage());
        }
    }

    /* ==================== 内部工具：查询与取值 ==================== */

    private void requireTenant(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法统计");
        }
    }

    private ProductionReport requireReport(String tenantId, String reportId) {
        if (blankToNull(reportId) == null) {
            throw new BusinessException(400, "缺少报表编号");
        }
        ProductionReport report = reportMapper.selectOne(new LambdaQueryWrapper<ProductionReport>()
                .eq(ProductionReport::getTenantId, tenantId)
                .eq(ProductionReport::getReportId, reportId.trim())
                .last("LIMIT 1"));
        if (report == null) {
            throw new BusinessException(404, "报表不存在：" + reportId.trim());
        }
        return report;
    }

    /** 批量取地块（按采收批次里出现的地块 id），用于"按地块/按作物"维度的面积与名称。 */
    private Map<Long, Plot> plotsById(String tenantId, List<HarvestBatch> batches) {
        java.util.Set<Long> ids = new java.util.LinkedHashSet<>();
        for (HarvestBatch batch : batches) {
            if (batch.getPlotId() != null) {
                ids.add(batch.getPlotId());
            }
        }
        Map<Long, Plot> result = new LinkedHashMap<>();
        if (ids.isEmpty()) {
            return result;
        }
        for (Plot plot : plotMapper.selectBatchIds(ids)) {
            if (tenantId.equals(plot.getTenantId())) {
                result.put(plot.getId(), plot);
            }
        }
        return result;
    }

    /** 地块标签：优先地块名，查不到就退化成"地块#id"（不编名字，也不让整行消失）。 */
    private static String plotLabel(Long plotId, Map<Long, Plot> plots) {
        if (plotId == null) {
            return "未标注地块";
        }
        Plot plot = plots.get(plotId);
        return plot == null || blankToNull(plot.getPlotName()) == null
                ? "地块#" + plotId : plot.getPlotName().trim();
    }

    private static boolean isDone(String status) {
        return status != null && TASK_DONE.contains(status.trim().toLowerCase(Locale.ROOT));
    }

    private static LocalDate parseDate(String text, String field) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + " 格式应为 yyyy-MM-dd：" + text.trim());
        }
    }

    /** 从 selectMaps 的第一行里取值（没有行时返回 null）。 */
    private static Object firstValue(List<Map<String, Object>> rows, String key) {
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        if (row == null) {
            return null;
        }
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static BigDecimal toDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            // 取不到数就按 0 处理的前提是"这一列一定是数字"（SUM/COUNT 的结果），
            // 真出现非数字说明 SQL 改了列，日志里留痕比抛 500 更便于定位
            log.warn("聚合结果不是数字，按 0 处理：{}", text);
            return BigDecimal.ZERO;
        }
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
