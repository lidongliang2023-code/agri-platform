package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.Farm;
import com.agri.production.entity.FarmComplianceCheck;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.Plot;
import com.agri.production.entity.ReportTask;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.FarmComplianceCheckMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.ReportTaskMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.IAdminReportService;
import com.agri.production.service.ProductionDashboardService;
import com.agri.production.service.TenantContextService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * 运营端统计报表 + 农场合规检查实现。
 */
@Slf4j
@Service
public class AdminReportServiceImpl implements IAdminReportService {

    private static final Path ADMIN_REPORT_DIR = Paths.get(System.getProperty("agri.admin.report-dir", "data/exports/admin-reports")).toAbsolutePath().normalize();
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ReportTaskMapper reportTaskMapper;
    private final FarmComplianceCheckMapper complianceCheckMapper;
    private final FarmMapper farmMapper;
    private final PlotMapper plotMapper;
    private final TaskMapper taskMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final InspectionMapper inspectionMapper;
    private final AlertRecordMapper alertRecordMapper;

    public AdminReportServiceImpl(ReportTaskMapper reportTaskMapper,
                                  FarmComplianceCheckMapper complianceCheckMapper,
                                  FarmMapper farmMapper,
                                  PlotMapper plotMapper,
                                  TaskMapper taskMapper,
                                  HarvestBatchMapper harvestBatchMapper,
                                  InspectionMapper inspectionMapper,
                                  AlertRecordMapper alertRecordMapper) {
        this.reportTaskMapper = reportTaskMapper;
        this.complianceCheckMapper = complianceCheckMapper;
        this.farmMapper = farmMapper;
        this.plotMapper = plotMapper;
        this.taskMapper = taskMapper;
        this.harvestBatchMapper = harvestBatchMapper;
        this.inspectionMapper = inspectionMapper;
        this.alertRecordMapper = alertRecordMapper;
    }

    @Override
    public PageResult<ReportTask> pageReports(int pageNum, int pageSize, String keyword, String status) {
        return pageReports(pageNum, pageSize, keyword, status, null, null, null, null);
    }

    @Override
    public PageResult<ReportTask> pageReports(int pageNum, int pageSize, String keyword, String status,
                                             String reportType, Long farmId, String startDate, String endDate) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? Math.min(pageSize, 200) : 10;
        LambdaQueryWrapper<ReportTask> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(ReportTask::getReportName, kw).or().like(ReportTask::getReportCode, kw));
        }
        if (status != null && !status.isBlank()) {
            w.eq(ReportTask::getStatus, status.trim().toUpperCase());
        }
        if (reportType != null && !reportType.isBlank()) {
            w.eq(ReportTask::getReportType, reportType.trim().toUpperCase());
        }
        if (farmId != null) {
            w.eq(ReportTask::getFarmId, farmId);
        }
        if (status != null && !status.isBlank() && !Set.of("PENDING", "RUNNING", "DONE", "FAILED").contains(status.trim().toUpperCase()))
            throw new BusinessException(400, "无效报表状态");
        if (reportType != null && !reportType.isBlank() && !Set.of("GOV", "BIZ", "QUALITY").contains(reportType.trim().toUpperCase()))
            throw new BusinessException(400, "无效报表类型");
        if (farmId != null && farmId <= 0) throw new BusinessException(400, "无效农场编号");
        LocalDate start = toDate(startDate);
        LocalDate end = toDate(endDate);
        if ((startDate != null && !startDate.isBlank() && start == null) ||
                (endDate != null && !endDate.isBlank() && end == null) ||
                (start != null && end != null && start.isAfter(end)))
            throw new BusinessException(400, "请选择有效筛选日期范围");
        if (start != null) {
            w.ge(ReportTask::getBizDateTo, start);
        }
        if (end != null) {
            w.le(ReportTask::getBizDateFrom, end);
        }
        w.orderByDesc(ReportTask::getCreateTime).orderByDesc(ReportTask::getId);
        Page<ReportTask> page = reportTaskMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String createReport(Map<String, Object> payload) {
        ReportTask task = new ReportTask();
        task.setReportCode("RPT" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS")) + UUID.randomUUID().toString().substring(0, 8));
        if (payload != null) {
            if (payload.containsKey("reportName")) {
                task.setReportName(str(payload.get("reportName")));
            }
            if (payload.containsKey("reportType")) {
                task.setReportType(str(payload.get("reportType")));
            }
            if (payload.containsKey("farmId")) {
                task.setFarmId(toLong(payload.get("farmId")));
            }
            if (payload.containsKey("bizDateFrom")) {
                task.setBizDateFrom(toDate(payload.get("bizDateFrom")));
            }
            if (payload.containsKey("bizDateTo")) {
                task.setBizDateTo(toDate(payload.get("bizDateTo")));
            }
            if (payload.containsKey("generatorId")) {
                task.setGeneratorId(str(payload.get("generatorId")));
            }
        }
        if (task.getReportName() == null || task.getReportName().isBlank() || task.getReportName().length() > 100)
            throw new BusinessException(400, "报表名称须为 1 至 100 字");
        if (payload != null && payload.get("farmId") != null &&
                (task.getFarmId() == null || task.getFarmId() <= 0))
            throw new BusinessException(400, "无效农场编号");
        task.setStatus("PENDING");
        if (!List.of("GOV", "BIZ", "QUALITY").contains(task.getReportType())) {
            throw new BusinessException(400, "请选择有效报表类型");
        }
        if (task.getBizDateFrom() == null || task.getBizDateTo() == null || task.getBizDateFrom().isAfter(task.getBizDateTo())) {
            throw new BusinessException(400, "请选择有效统计日期范围");
        }
        if (task.getBizDateFrom().plusYears(1).isBefore(task.getBizDateTo())) {
            throw new BusinessException(400, "统计周期最长支持 1 年");
        }
        String actorId = TenantContextService.currentUserId();
        if (actorId == null) throw new BusinessException(403, "无法确认报表创建人");
        task.setGeneratorId(actorId);
        if (task.getFarmId() != null) {
            Farm farm = farmMapper.selectById(task.getFarmId());
            if (farm == null || farm.getTenantId() == null) throw new BusinessException(404, "农场不存在或未登记主体");
            task.setTenantId(farm.getTenantId());
        } else {
            task.setTenantId(TenantContextService.currentTenantId());
        }
        task.setCreateTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        task.setDeleted(0);
        reportTaskMapper.insert(task);
        log.info("新建报表任务：{} {}", task.getReportCode(), task.getReportName());
        return task.getReportCode();
    }

    @Override
    public ReportTask getReport(String reportCode) {
        ReportTask task = reportTaskMapper.selectOne(new LambdaQueryWrapper<ReportTask>().eq(ReportTask::getReportCode, reportCode));
        if (task == null) throw new BusinessException(404, "报表任务不存在");
        return task;
    }

    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public ReportTask generateReportFile(String reportCode) {
        ReportTask task = reportTaskMapper.lockByCode(reportCode);
        if (task == null) throw new BusinessException(404, "报表任务不存在");
        if ("DONE".equalsIgnoreCase(task.getStatus())) {
            if (Files.isRegularFile(ADMIN_REPORT_DIR.resolve(task.getReportCode() + ".csv"))) return task;
            throw new BusinessException(409, "已生成快照文件缺失，请登记新报表，避免覆盖历史快照");
        }
        LocalDateTime fromTime = task.getBizDateFrom().atStartOfDay();
        LocalDateTime toTime = task.getBizDateTo().plusDays(1).atStartOfDay();

        try {
            byte[] csvBytes = buildCsvContent(task, fromTime, toTime);
            Files.createDirectories(ADMIN_REPORT_DIR);
            Path filePath = ADMIN_REPORT_DIR.resolve(task.getReportCode() + ".csv");
            Path staging = Files.createTempFile(ADMIN_REPORT_DIR, "snapshot-", ".tmp");
            try {
                Files.write(staging, csvBytes);
                Files.move(staging, filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(staging);
            }

            task.setStatus("DONE");
            task.setGeneratedAt(LocalDateTime.now());
            task.setFileUrl("/api/v1/production/admin/reports/" + task.getReportCode() + "/file");
            task.setUpdateTime(LocalDateTime.now());
            if (reportTaskMapper.updateById(task) != 1) throw new IllegalStateException("报表状态保存失败");
            return task;
        } catch (Exception e) {
            log.error("报表快照生成失败：{}", task.getReportCode(), e);
            task.setStatus("FAILED");
            task.setFileUrl(null);
            task.setGeneratedAt(null);
            task.setUpdateTime(LocalDateTime.now());
            reportTaskMapper.updateById(task);
            throw new BusinessException(500, "报表生成失败：" + e.getMessage());
        }
    }

    @Override
    public ReportFile downloadReportFile(String reportCode) {
        ReportTask task = getReport(reportCode);
        if (!"DONE".equalsIgnoreCase(task.getStatus())) {
            throw new BusinessException(400, "报表尚未生成成功，无法下载");
        }
        Path filePath = ADMIN_REPORT_DIR.resolve(task.getReportCode() + ".csv");
        if (!Files.exists(filePath)) {
            throw new BusinessException(404, "报表快照文件不存在或已归档，请登记新报表");
        }
        try {
            byte[] bytes = Files.readAllBytes(filePath);
            String safeName = (task.getReportName() == null ? task.getReportCode() : task.getReportName().trim()) + ".csv";
            return new ReportFile(safeName, bytes);
        } catch (IOException e) {
            throw new BusinessException(500, "读取报表文件失败：" + e.getMessage());
        }
    }

    private byte[] buildCsvContent(ReportTask task, LocalDateTime fromTime, LocalDateTime toTime) {
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');
        sb.append("报表名称,").append(csv(task.getReportName())).append('\n');
        sb.append("报表编号,").append(csv(task.getReportCode())).append('\n');
        sb.append("报表类型,").append(csv(Map.of("GOV", "生产监管", "BIZ", "生产经营（不含交易金额）", "QUALITY", "质量").getOrDefault(Objects.toString(task.getReportType(), ""), "未知类型"))).append('\n');
        sb.append("统计期间,").append(task.getBizDateFrom()).append(" 至 ").append(task.getBizDateTo()).append('\n');
        sb.append("农场筛选,").append(task.getFarmId() == null ? "全平台（未限定单农场）" : ("农场ID：" + task.getFarmId())).append('\n');
        sb.append("生成时间,").append(DATETIME.format(LocalDateTime.now())).append('\n');
        sb.append("生成操作人,").append(csv(TenantContextService.currentOperator())).append('\n');
        sb.append("数据口径说明,生产与质量指标均取自本服务已落库真实业务记录；金额指标本部署未接入，不作编造。\n\n");

        List<Farm> farmList;
        if (task.getFarmId() != null) {
            Farm single = farmMapper.selectById(task.getFarmId());
            farmList = single == null ? List.of() : List.of(single);
        } else {
            farmList = farmMapper.selectList(new LambdaQueryWrapper<Farm>().orderByAsc(Farm::getId));
        }

        sb.append("指标口径,地块与面积为生成时点在册值；任务按计划开始日、采收按采收日、检测按采样日、告警按创建日纳入期间。\n");
        sb.append("比率口径,任务验收完成率=验收通过任务/期间任务；检测合格率=已完成合格检测/(已完成合格+不合格检测)；告警处置完成率=明确已处理或关闭告警/期间告警；无分母显示—；合计按数量加权。\n");
        long[] totals = new long[10];
        BigDecimal totalArea = BigDecimal.ZERO, totalKg = BigDecimal.ZERO;
        Map<String, BigDecimal> unconverted = new LinkedHashMap<>();
        sb.append("农场ID,农场名称,所属主体,在册地块数,在册面积(亩),期间农事任务数,农事任务验收通过数,任务验收完成率,期间采收批次数,已换算采收量(kg),未换算采收量批次数,期间检测单数,检测合格单数,检测不合格单数,检测合格率,期间告警数,未关闭告警数,告警处置完成率\n");

        for (Farm f : farmList) {
            Long farmId = f.getId();
            List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<Plot>().eq(Plot::getFarmId, farmId));
            BigDecimal farmArea = plots.stream()
                    .map(Plot::getArea)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            List<Task> tasks = taskMapper.selectList(new LambdaQueryWrapper<Task>()
                    .eq(Task::getFarmId, farmId)
                    .ge(Task::getPlanStartTime, fromTime)
                    .lt(Task::getPlanStartTime, toTime));
            long doneTasks = tasks.stream()
                    .filter(t -> Set.of("completed", "done").contains(Objects.toString(t.getStatus(), "").toLowerCase())
                            && Integer.valueOf(1).equals(t.getAcceptStatus()))
                    .count();

            List<HarvestBatch> batches = harvestBatchMapper.selectList(new LambdaQueryWrapper<HarvestBatch>()
                    .eq(HarvestBatch::getFarmId, farmId)
                    .ge(HarvestBatch::getHarvestDate, task.getBizDateFrom())
                    .le(HarvestBatch::getHarvestDate, task.getBizDateTo()));
            BigDecimal convertedKg = BigDecimal.ZERO;
            int unconvertedBatches = 0;
            for (HarvestBatch b : batches) {
                BigDecimal kg = ProductionDashboardService.kilograms(b.getQuantity(), b.getUnit());
                if (kg != null) {
                    convertedKg = convertedKg.add(kg);
                } else if (b.getQuantity() != null && b.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
                    unconvertedBatches++;
                    unconverted.merge(Objects.toString(b.getUnit(), "未填写单位").isBlank() ? "未填写单位" : Objects.toString(b.getUnit()), b.getQuantity(), BigDecimal::add);
                }
            }

            List<Inspection> inspections = inspectionMapper.selectList(new LambdaQueryWrapper<Inspection>()
                    .eq(Inspection::getFarmId, farmId)
                    .ge(Inspection::getSampleAt, fromTime)
                    .lt(Inspection::getSampleAt, toTime));
            long passCount = inspections.stream()
                    .filter(i -> "PASS".equalsIgnoreCase(i.getResult()) && "DONE".equalsIgnoreCase(i.getStatus()))
                    .count();
            long failCount = inspections.stream()
                    .filter(i -> "FAIL".equalsIgnoreCase(i.getResult()) && "DONE".equalsIgnoreCase(i.getStatus()))
                    .count();

            List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<AlertRecord>()
                    .eq(AlertRecord::getFarmId, farmId)
                    .ge(AlertRecord::getCreateTime, fromTime)
                    .lt(AlertRecord::getCreateTime, toTime));
            long closedAlerts = alerts.stream().filter(a ->
                    Set.of("handled", "closed", "3", "4").contains(Objects.toString(a.getStatus(), "").toLowerCase())).count();
            long openAlerts = alerts.size() - closedAlerts;
            String taskPassRate = percentage(doneTasks, tasks.size());
            String inspectPassRate = percentage(passCount, passCount + failCount);
            String alertCloseRate = percentage(closedAlerts, alerts.size());
            totals[0] += plots.size(); totals[1] += tasks.size(); totals[2] += doneTasks;
            totals[3] += batches.size(); totals[4] += unconvertedBatches; totals[5] += inspections.size();
            totals[6] += passCount; totals[7] += failCount; totals[8] += alerts.size(); totals[9] += openAlerts;
            totalArea = totalArea.add(farmArea); totalKg = totalKg.add(convertedKg);

            sb.append(farmId).append(',')
                    .append(csv(f.getFarmName())).append(',')
                    .append(csv(f.getTenantId())).append(',')
                    .append(plots.size()).append(',')
                    .append(farmArea.setScale(2, RoundingMode.HALF_UP)).append(',')
                    .append(tasks.size()).append(',')
                    .append(doneTasks).append(',')
                    .append(taskPassRate).append(',')
                    .append(batches.size()).append(',')
                    .append(convertedKg.setScale(2, RoundingMode.HALF_UP)).append(',')
                    .append(unconvertedBatches).append(',')
                    .append(inspections.size()).append(',')
                    .append(passCount).append(',')
                    .append(failCount).append(',')
                    .append(inspectPassRate).append(',')
                    .append(alerts.size()).append(',')
                    .append(openAlerts).append(',')
                    .append(alertCloseRate).append('\n');
        }

        sb.append("合计,全部选中农场,,").append(totals[0]).append(',').append(totalArea.setScale(2, RoundingMode.HALF_UP)).append(',')
                .append(totals[1]).append(',').append(totals[2]).append(',').append(percentage(totals[2], totals[1])).append(',')
                .append(totals[3]).append(',').append(totalKg.setScale(2, RoundingMode.HALF_UP)).append(',').append(totals[4]).append(',')
                .append(totals[5]).append(',').append(totals[6]).append(',').append(totals[7]).append(',')
                .append(percentage(totals[6], totals[6]+totals[7])).append(',').append(totals[8]).append(',').append(totals[9]).append(',')
                .append(percentage(totals[8]-totals[9], totals[8])).append('\n');
        sb.append("\n未换算采收单位,数量（不同单位不相加）\n");
        unconverted.forEach((unit, quantity) -> sb.append(csv(unit)).append(',').append(quantity.toPlainString()).append('\n'));
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String percentage(long numerator, long denominator) {
        return denominator == 0 ? "—" : BigDecimal.valueOf(numerator).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP).toPlainString() + "%";
    }

    private static String csv(String raw) {
        String text = raw == null ? "" : raw;
        String trimmed = text.stripLeading();
        if (!trimmed.isEmpty() && "=+-@".indexOf(trimmed.charAt(0)) >= 0) text = "'" + text;
        if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
            return '"' + text.replace("\"", "\"\"") + '"';
        }
        return text;
    }

    @Override
    public List<ReportTask> listByType(String reportType) {
        LambdaQueryWrapper<ReportTask> w = new LambdaQueryWrapper<>();
        if (reportType != null && !reportType.isBlank()) {
            w.eq(ReportTask::getReportType, reportType.trim().toUpperCase());
        }
        w.orderByDesc(ReportTask::getCreateTime).orderByDesc(ReportTask::getId);
        return reportTaskMapper.selectList(w);
    }

    @Override
    public Map<String, Object> reportStat() {
        List<ReportTask> all = reportTaskMapper.selectList(new LambdaQueryWrapper<>());
        String month = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        long monthCount = all.stream()
                .filter(task -> task.getCreateTime() != null
                        && task.getCreateTime().toLocalDate().format(DateTimeFormatter.ofPattern("yyyy-MM")).equals(month))
                .count();
        long failed = all.stream().filter(task -> "FAILED".equalsIgnoreCase(task.getStatus())).count();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCount", all.size());
        result.put("monthCount", monthCount);
        result.put("downloadCount", null);
        result.put("failedCount", failed);
        return result;
    }

    @Override
    public PageResult<FarmComplianceCheck> pageComplianceChecks(int pageNum, int pageSize, Long farmId,
                                                              Integer result) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FarmComplianceCheck> w = new LambdaQueryWrapper<>();
        if (farmId != null) {
            w.eq(FarmComplianceCheck::getFarmId, farmId);
        }
        if (result != null) {
            w.eq(FarmComplianceCheck::getCheckResult, result);
        }
        w.orderByDesc(FarmComplianceCheck::getCheckedAt).orderByDesc(FarmComplianceCheck::getId);
        Page<FarmComplianceCheck> page = complianceCheckMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    public Map<String, Object> farmComplianceProfile(Long farmId) {
        Farm farm = farmId == null ? null : farmMapper.selectById(farmId);
        if (farm == null) {
            throw new BusinessException(404, "农场不存在：" + farmId);
        }
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getFarmId, farmId));
        List<FarmComplianceCheck> checks = complianceCheckMapper.selectList(
                new LambdaQueryWrapper<FarmComplianceCheck>().eq(FarmComplianceCheck::getFarmId, farmId));

        long openViolations = checks.stream()
                .filter(check -> check.getCheckResult() != null && check.getCheckResult() >= 2)
                .filter(check -> !"rectified".equalsIgnoreCase(check.getRectifyStatus()))
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmId", farm.getId());
        result.put("farmName", farm.getFarmName());
        result.put("tenantId", farm.getTenantId());
        result.put("status", farm.getStatus());
        result.put("plotCount", plots.size());
        result.put("totalChecks", checks.size());
        result.put("openViolations", openViolations);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FarmComplianceCheck updateComplianceCheck(String checkId, Map<String, Object> patch) {
        FarmComplianceCheck row = complianceCheckMapper.selectOne(new LambdaQueryWrapper<FarmComplianceCheck>()
                .eq(FarmComplianceCheck::getCheckCode, checkId));
        if (row == null) {
            throw new BusinessException(404, "检查记录不存在：" + checkId);
        }
        if (patch == null || patch.isEmpty()) {
            return row;
        }

        if (patch.containsKey("checkResult")) {
            Integer r = toInt(patch.get("checkResult"));
            if (r != null && r >= 0 && r <= 2) {
                row.setCheckResult(r);
            }
        }
        if (patch.containsKey("rectifyStatus")) {
            String s = str(patch.get("rectifyStatus"));
            if (s != null && List.of("none", "pending", "processing", "reviewing", "rectified", "overdue").contains(s.toLowerCase())) {
                row.setRectifyStatus(s.toLowerCase());
            }
        }
        if (patch.containsKey("rectifyDeadLine")) {
            row.setRectifyDeadline(toDate(patch.get("rectifyDeadLine")));
        }
        if (patch.containsKey("rectifyRemark")) {
            row.setRectifyRemark(str(patch.get("rectifyRemark")));
        }
        if (patch.containsKey("problemDesc")) {
            row.setProblemDesc(str(patch.get("problemDesc")));
        }

        row.setUpdateTime(LocalDateTime.now());
        complianceCheckMapper.updateById(row);
        log.info("合规检查记录已更新：{} {}", row.getCheckCode(), row.getRectifyStatus());
        return row;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString().trim();
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(o.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(o.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate toDate(Object o) {
        if (o == null) return null;
        if (o instanceof LocalDate d) return d;
        String s = o.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return LocalDate.parse(s, DATE);
        } catch (DateTimeParseException e) {
            try {
                return LocalDateTime.parse(s, DATETIME).toLocalDate();
            } catch (DateTimeParseException ex) {
                return null;
            }
        }
    }
}
