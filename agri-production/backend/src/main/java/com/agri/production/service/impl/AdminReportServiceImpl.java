package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Farm;
import com.agri.production.entity.FarmComplianceCheck;
import com.agri.production.entity.Plot;
import com.agri.production.entity.ReportTask;
import com.agri.production.mapper.FarmComplianceCheckMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.ReportTaskMapper;
import com.agri.production.service.IAdminReportService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端统计报表 + 农场合规检查实现。
 *
 * <p>表由 schema-patch-reports-farms.sql 建 —— 这两块的内容此前只在平台侧，本服务没有表。</p>
 */
@Slf4j
@Service
public class AdminReportServiceImpl implements IAdminReportService {

    private static final String DEFAULT_TENANT = "2001";

    private final ReportTaskMapper reportTaskMapper;
    private final FarmComplianceCheckMapper complianceCheckMapper;
    private final FarmMapper farmMapper;
    private final PlotMapper plotMapper;

    public AdminReportServiceImpl(ReportTaskMapper reportTaskMapper,
                                  FarmComplianceCheckMapper complianceCheckMapper,
                                  FarmMapper farmMapper,
                                  PlotMapper plotMapper) {
        this.reportTaskMapper = reportTaskMapper;
        this.complianceCheckMapper = complianceCheckMapper;
        this.farmMapper = farmMapper;
        this.plotMapper = plotMapper;
    }

    @Override
    public PageResult<ReportTask> pageReports(int pageNum, int pageSize, String keyword, String status) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<ReportTask> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(ReportTask::getReportName, kw).or().like(ReportTask::getReportCode, kw));
        }
        if (status != null && !status.isBlank()) {
            w.eq(ReportTask::getStatus, status.trim().toUpperCase());
        }
        w.orderByDesc(ReportTask::getCreateTime).orderByDesc(ReportTask::getId);
        Page<ReportTask> page = reportTaskMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String createReport(Map<String, Object> payload) {
        ReportTask task = new ReportTask();
        task.setReportCode("RPT" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
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
        if (task.getReportName() == null || task.getReportName().isBlank()) {
            throw new BusinessException(400, "报表名称不能为空");
        }
        // 新建就是"待生成"：不预填 generated_at / file_url —— 那是生成完成才有的事实
        task.setStatus("PENDING");
        task.setTenantId(DEFAULT_TENANT);
        task.setCreateTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        task.setDeleted(0);
        reportTaskMapper.insert(task);
        log.info("新建报表任务：{} {}", task.getReportCode(), task.getReportName());
        return task.getReportCode();
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
        // 本服务没有下载流水表（页面的导出也不经后端）→ 只能给 0，且这不是统计值
        result.put("downloadCount", 0);
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
        boolean hasSevere = checks.stream()
                .filter(check -> check.getCheckResult() != null && check.getCheckResult() == 3)
                .anyMatch(check -> !"rectified".equalsIgnoreCase(check.getRectifyStatus()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmId", String.valueOf(farm.getId()));
        result.put("farmName", farm.getFarmName());
        result.put("plotCount", plots.size());
        // 认证数三项：本服务还没有农场资质证照表（那属于尚未迁移的 /farms 段），
        // 所以恒为 0 且**不是统计值** —— 页面按「未接入」提示，不编一个认证数量
        result.put("certCount", 0);
        result.put("certExpiring", 0);
        result.put("certExpired", 0);
        result.put("certSource", "none");
        // 合规等级按**检查记录**判：有未整改的严重违规 → RISK；有未整改的限期整改 → WARN；否则 OK
        result.put("complianceLevel", hasSevere ? "RISK" : (openViolations > 0 ? "WARN" : "OK"));
        result.put("complianceCheckCount", checks.size());
        result.put("openViolations", openViolations);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FarmComplianceCheck updateComplianceCheck(String checkId, Map<String, Object> patch) {
        if (checkId == null || checkId.isBlank()) {
            throw new BusinessException(400, "缺少 checkId");
        }
        FarmComplianceCheck check = complianceCheckMapper.selectOne(
                new LambdaQueryWrapper<FarmComplianceCheck>()
                        .eq(FarmComplianceCheck::getCheckCode, checkId.trim()).last("LIMIT 1"));
        if (check == null) {
            throw new BusinessException(404, "合规检查记录不存在：" + checkId);
        }
        if (patch != null) {
            if (patch.containsKey("result")) {
                check.setCheckResult(toInt(patch.get("result")));
            }
            if (patch.containsKey("problem")) {
                check.setProblemDesc(str(patch.get("problem")));
            }
            if (patch.containsKey("rectifyRequirement")) {
                check.setRectifyRequirement(str(patch.get("rectifyRequirement")));
            }
            if (patch.containsKey("rectifyDeadline")) {
                check.setRectifyDeadline(toDate(patch.get("rectifyDeadline")));
            }
            if (patch.containsKey("checkerName")) {
                check.setCheckerName(str(patch.get("checkerName")));
            }
            if (patch.containsKey("checkedAt")) {
                check.setCheckedAt(toDateTime(patch.get("checkedAt")));
            }
            if (patch.containsKey("rectifyStatus")) {
                check.setRectifyStatus(str(patch.get("rectifyStatus")));
            }
            if (patch.containsKey("rectifyRemark")) {
                check.setRectifyRemark(str(patch.get("rectifyRemark")));
            }
            // 整改完成时间：只有走进"已整改"才自动补，避免审核中的记录被写成已完成
            if ("rectified".equalsIgnoreCase(check.getRectifyStatus()) && check.getRectifiedAt() == null) {
                check.setRectifiedAt(LocalDateTime.now());
            }
        }
        check.setUpdateTime(LocalDateTime.now());
        complianceCheckMapper.updateById(check);
        log.info("合规检查已更新：{} rectifyStatus={}", check.getCheckCode(), check.getRectifyStatus());
        return complianceCheckMapper.selectById(check.getId());
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer toInt(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        String normalized = text.endsWith(".0") ? text.substring(0, text.length() - 2) : text;
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Long toLong(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate toDate(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text.substring(0, Math.min(10, text.length())));
        } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            return null;
        }
    }

    private static LocalDateTime toDateTime(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        String normalized = text.replace('T', ' ');
        for (String pattern : List.of("yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm", "yyyy-MM-dd")) {
            try {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
                return pattern.equals("yyyy-MM-dd")
                        ? LocalDate.parse(normalized, formatter).atStartOfDay()
                        : LocalDateTime.parse(normalized, formatter);
            } catch (Exception ignored) {
                // 换下一个格式
            }
        }
        return null;
    }
}
