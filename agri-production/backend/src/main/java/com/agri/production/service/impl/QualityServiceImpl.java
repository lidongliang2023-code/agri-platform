package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.InspectionSaveDTO;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.Plot;
import com.agri.production.entity.QualityGradeRule;
import com.agri.production.entity.TestingLab;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.QualityGradeRuleMapper;
import com.agri.production.mapper.TestingLabMapper;
import com.agri.production.service.IQualityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
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
import java.util.concurrent.ThreadLocalRandom;

/**
 * 质量管理。
 *
 * <p>状态机（与页面取值域一致）：PENDING 待检 → TESTING 检测中 → DONE 已完成；
 * 结论 result 只有 PASS / FAIL 两个值，且**有结论就置 DONE** —— 否则页面上会出现
 * "结论：合格 / 状态：待检"这种自相矛盾的行。</p>
 */
@Service
@Slf4j
public class QualityServiceImpl implements IQualityService {

    private static final String RESULT_PASS = "PASS";
    private static final String RESULT_FAIL = "FAIL";
    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_TESTING = "TESTING";
    private static final String STATUS_DONE = "DONE";

    private static final DateTimeFormatter CODE_DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final InspectionMapper inspectionMapper;
    private final TestingLabMapper labMapper;
    private final QualityGradeRuleMapper gradeRuleMapper;
    private final PlotMapper plotMapper;

    public QualityServiceImpl(InspectionMapper inspectionMapper, TestingLabMapper labMapper,
                             QualityGradeRuleMapper gradeRuleMapper, PlotMapper plotMapper) {
        this.inspectionMapper = inspectionMapper;
        this.labMapper = labMapper;
        this.gradeRuleMapper = gradeRuleMapper;
        this.plotMapper = plotMapper;
    }

    /* ==================== 检测单 ==================== */

    @Override
    public PageResult<Inspection> pageInspections(int pageNum, int pageSize, String keyword, String status, Long farmId,
                                                 Long batchId, String inspectionType, String result,
                                                 String startDate, String endDate, String tenantId) {
        LambdaQueryWrapper<Inspection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Inspection::getTenantId, tenantId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            wrapper.and(q -> q.like(Inspection::getInspectionNo, kw)
                    .or().like(Inspection::getBatchNo, kw)
                    .or().like(Inspection::getCropName, kw));
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(Inspection::getStatus, status.trim().toUpperCase());
        }
        if (farmId != null) {
            wrapper.eq(Inspection::getFarmId, farmId);
        }
        if (batchId != null) {
            wrapper.eq(Inspection::getBatchId, batchId);
        }
        if (inspectionType != null && !inspectionType.isBlank()) {
            wrapper.eq(Inspection::getInspectionType, inspectionType.trim().toUpperCase());
        }
        if (result != null && !result.isBlank()) {
            wrapper.eq(Inspection::getResult, result.trim().toUpperCase());
        }
        LocalDateTime from = parseDateTimeOrNull(startDate, true);
        LocalDateTime to = parseDateTimeOrNull(endDate, false);
        if (from != null) {
            wrapper.ge(Inspection::getSampleAt, from);
        }
        if (to != null) {
            wrapper.le(Inspection::getSampleAt, to);
        }
        wrapper.orderByDesc(Inspection::getSampleAt).orderByDesc(Inspection::getInspectionId);

        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        IPage<Inspection> pageResult = inspectionMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return PageResult.of(pageResult.getRecords(), pageResult.getTotal(), safePage, safeSize);
    }

    @Override
    public Inspection detail(Long inspectionId, String tenantId) {
        return getOwned(inspectionId, tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inspection create(InspectionSaveDTO dto, String tenantId) {
        if (dto == null) {
            throw new BusinessException(400, "检测单内容不能为空");
        }
        Inspection inspection = new Inspection();
        inspection.setTenantId(tenantId);
        applyDto(inspection, dto);
        if (inspection.getInspectionNo() == null || inspection.getInspectionNo().isBlank()) {
            inspection.setInspectionNo(nextInspectionNo(tenantId));
        }
        if (inspection.getStatus() == null) {
            inspection.setStatus(STATUS_PENDING);
        }
        if (inspection.getSampleAt() == null) {
            inspection.setSampleAt(LocalDateTime.now());
        }
        alignResultAndStatus(inspection);
        inspection.setCreateTime(LocalDateTime.now());
        inspection.setUpdateTime(LocalDateTime.now());
        inspection.setDeleted(0);
        inspectionMapper.insert(inspection);
        return inspection;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inspection update(Long inspectionId, InspectionSaveDTO dto, String tenantId) {
        Inspection inspection = getOwned(inspectionId, tenantId);
        if (dto == null) {
            throw new BusinessException(400, "检测单内容不能为空");
        }
        // 就地改已加载的实体：页面编辑只下发一部分字段，
        // new 一个空实体再 updateById 会把没下发的列清成 null
        applyDto(inspection, dto);
        alignResultAndStatus(inspection);
        inspection.setUpdateTime(LocalDateTime.now());
        inspectionMapper.updateById(inspection);
        return inspection;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long inspectionId, String tenantId) {
        getOwned(inspectionId, tenantId);
        inspectionMapper.deleteById(inspectionId);
    }

    @Override
    public List<Inspection> byBatch(Long batchId, String tenantId) {
        if (batchId == null) {
            throw new BusinessException(400, "缺少 batchId");
        }
        return inspectionMapper.selectList(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getTenantId, tenantId)
                .eq(Inspection::getBatchId, batchId)
                .orderByDesc(Inspection::getSampleAt));
    }

    @Override
    public Map<String, Object> items(Long inspectionId, String tenantId) {
        Inspection inspection = getOwned(inspectionId, tenantId);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("inspectionId", inspection.getInspectionId());
        detail.put("inspectionNo", inspection.getInspectionNo());
        detail.put("inspectionType", inspection.getInspectionType());
        detail.put("result", inspection.getResult());
        detail.put("status", inspection.getStatus());
        // 逐项明细（InspectionItem[]）页面还没有消费：它当前是从头部字段派生出一行展示
        // （itemName 取 item ?? inspectionType）。这里给空数组，而不是编几张假明细。
        detail.put("items", List.of());
        return detail;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inspection submitResult(Long inspectionId, String result, String reportUrl, String tenantId) {
        Inspection inspection = getOwned(inspectionId, tenantId);
        String normalized = normalizeResult(result);
        if (normalized == null) {
            throw new BusinessException(400, "结论只能是 PASS 或 FAIL（收到：" + result + "）");
        }
        if (STATUS_PENDING.equals(inspection.getStatus())) {
            log.info("检测单 {} 从 PENDING 直接出结论 {}", inspectionId, normalized);
        }
        inspection.setResult(normalized);
        inspection.setStatus(STATUS_DONE);
        if (reportUrl != null && !reportUrl.isBlank()) {
            inspection.setReportUrl(reportUrl.trim());
        }
        inspection.setUpdateTime(LocalDateTime.now());
        inspectionMapper.updateById(inspection);
        return inspection;
    }

    @Override
    public Map<String, Long> gradingStats(String tenantId) {
        List<Inspection> inspections = inspectionMapper.selectList(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getTenantId, tenantId));
        long pass = inspections.stream().filter(i -> RESULT_PASS.equals(i.getResult())).count();
        long fail = inspections.stream().filter(i -> RESULT_FAIL.equals(i.getResult())).count();
        Map<String, Long> stats = new LinkedHashMap<>();
        // 键名必须是大写 PASS / FAIL —— 页面 statsQuery.data?.PASS 就是这么读的
        stats.put(RESULT_PASS, pass);
        stats.put(RESULT_FAIL, fail);
        return stats;
    }

    /* ==================== 分级规则 ==================== */

    @Override
    public PageResult<QualityGradeRule> pageGradeRules(int pageNum, int pageSize, Long cropId, Integer status, String tenantId) {
        LambdaQueryWrapper<QualityGradeRule> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(QualityGradeRule::getTenantId, tenantId);
        if (cropId != null) {
            wrapper.eq(QualityGradeRule::getCropId, cropId);
        }
        if (status != null) {
            wrapper.eq(QualityGradeRule::getStatus, status);
        }
        wrapper.orderByAsc(QualityGradeRule::getGradeCode).orderByAsc(QualityGradeRule::getRuleId);
        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        IPage<QualityGradeRule> pageResult = gradeRuleMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return PageResult.of(pageResult.getRecords(), pageResult.getTotal(), safePage, safeSize);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QualityGradeRule createGradeRule(QualityGradeRule rule, String tenantId) {
        if (rule == null || isBlank(rule.getGradeCode())) {
            throw new BusinessException(400, "分级编码不能为空（A / B / C / D）");
        }
        QualityGradeRule saved = new QualityGradeRule();
        saved.setTenantId(tenantId);
        saved.setGradeCode(rule.getGradeCode().trim().toUpperCase());
        saved.setGradeName(isBlank(rule.getGradeName()) ? saved.getGradeCode() + " 级" : rule.getGradeName().trim());
        saved.setCropId(rule.getCropId());
        saved.setCropName(trimToNull(rule.getCropName()));
        saved.setMetrics(trimToNull(rule.getMetrics()));
        saved.setCriteria(trimToNull(rule.getCriteria()));
        saved.setPriceFactor(rule.getPriceFactor());
        saved.setStatus(rule.getStatus() == null ? 1 : rule.getStatus());
        saved.setRemark(trimToNull(rule.getRemark()));
        saved.setCreateTime(LocalDateTime.now());
        saved.setUpdateTime(LocalDateTime.now());
        saved.setDeleted(0);
        gradeRuleMapper.insert(saved);
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QualityGradeRule updateGradeRule(Long ruleId, QualityGradeRule rule, String tenantId) {
        QualityGradeRule saved = getOwnedRule(ruleId, tenantId);
        if (rule == null) {
            throw new BusinessException(400, "分级规则内容不能为空");
        }
        if (!isBlank(rule.getGradeCode())) {
            saved.setGradeCode(rule.getGradeCode().trim().toUpperCase());
        }
        if (rule.getGradeName() != null) {
            saved.setGradeName(trimToNull(rule.getGradeName()));
        }
        if (rule.getCropId() != null) {
            saved.setCropId(rule.getCropId());
        }
        if (rule.getCropName() != null) {
            saved.setCropName(trimToNull(rule.getCropName()));
        }
        if (rule.getMetrics() != null) {
            saved.setMetrics(trimToNull(rule.getMetrics()));
        }
        if (rule.getCriteria() != null) {
            saved.setCriteria(trimToNull(rule.getCriteria()));
        }
        if (rule.getPriceFactor() != null) {
            saved.setPriceFactor(rule.getPriceFactor());
        }
        if (rule.getStatus() != null) {
            saved.setStatus(rule.getStatus());
        }
        if (rule.getRemark() != null) {
            saved.setRemark(trimToNull(rule.getRemark()));
        }
        saved.setUpdateTime(LocalDateTime.now());
        gradeRuleMapper.updateById(saved);
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteGradeRule(Long ruleId, String tenantId) {
        getOwnedRule(ruleId, tenantId);
        gradeRuleMapper.deleteById(ruleId);
    }

    /* ==================== 检测机构 ==================== */

    @Override
    public PageResult<TestingLab> pageLabs(int pageNum, int pageSize, String keyword, Integer status, String tenantId) {
        LambdaQueryWrapper<TestingLab> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TestingLab::getTenantId, tenantId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            wrapper.and(q -> q.like(TestingLab::getLabName, kw).or().like(TestingLab::getLabCode, kw));
        }
        if (status != null) {
            wrapper.eq(TestingLab::getStatus, status);
        }
        wrapper.orderByAsc(TestingLab::getLabLevel).orderByAsc(TestingLab::getLabId);
        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 100;
        IPage<TestingLab> pageResult = labMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return PageResult.of(pageResult.getRecords(), pageResult.getTotal(), safePage, safeSize);
    }

    @Override
    public List<TestingLab> activeLabs(String tenantId) {
        return labMapper.selectList(new LambdaQueryWrapper<TestingLab>()
                .eq(TestingLab::getTenantId, tenantId)
                .eq(TestingLab::getStatus, 1)
                .orderByAsc(TestingLab::getLabLevel)
                .orderByAsc(TestingLab::getLabId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestingLab createLab(TestingLab lab, String tenantId) {
        if (lab == null || lab.getLabName() == null || lab.getLabName().isBlank()) {
            throw new BusinessException(400, "机构名称不能为空");
        }
        TestingLab saved = new TestingLab();
        saved.setTenantId(tenantId);
        saved.setLabName(lab.getLabName().trim());
        saved.setLabCode(lab.getLabCode() == null || lab.getLabCode().isBlank()
                ? nextLabCode(tenantId) : lab.getLabCode().trim());
        saved.setLabLevel(lab.getLabLevel());
        saved.setContactName(trimToNull(lab.getContactName()));
        saved.setContactPhone(trimToNull(lab.getContactPhone()));
        saved.setRegion(trimToNull(lab.getRegion()));
        saved.setCertNo(trimToNull(lab.getCertNo()));
        saved.setStatus(lab.getStatus() == null ? 1 : lab.getStatus());
        saved.setRemark(trimToNull(lab.getRemark()));
        saved.setCreateTime(LocalDateTime.now());
        saved.setUpdateTime(LocalDateTime.now());
        saved.setDeleted(0);
        labMapper.insert(saved);
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestingLab updateLab(Long labId, TestingLab lab, String tenantId) {
        TestingLab saved = getOwnedLab(labId, tenantId);
        if (lab == null) {
            throw new BusinessException(400, "机构内容不能为空");
        }
        if (lab.getLabName() != null && !lab.getLabName().isBlank()) {
            saved.setLabName(lab.getLabName().trim());
        }
        if (lab.getLabCode() != null && !lab.getLabCode().isBlank()) {
            saved.setLabCode(lab.getLabCode().trim());
        }
        if (lab.getLabLevel() != null) {
            saved.setLabLevel(lab.getLabLevel());
        }
        if (lab.getContactName() != null) {
            saved.setContactName(trimToNull(lab.getContactName()));
        }
        if (lab.getContactPhone() != null) {
            saved.setContactPhone(trimToNull(lab.getContactPhone()));
        }
        if (lab.getRegion() != null) {
            saved.setRegion(trimToNull(lab.getRegion()));
        }
        if (lab.getCertNo() != null) {
            saved.setCertNo(trimToNull(lab.getCertNo()));
        }
        if (lab.getStatus() != null) {
            saved.setStatus(lab.getStatus());
        }
        if (lab.getRemark() != null) {
            saved.setRemark(trimToNull(lab.getRemark()));
        }
        saved.setUpdateTime(LocalDateTime.now());
        labMapper.updateById(saved);
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteLab(Long labId, String tenantId) {
        getOwnedLab(labId, tenantId);
        labMapper.deleteById(labId);
    }

    /* ==================== 内部工具 ==================== */

    private Inspection getOwned(Long inspectionId, String tenantId) {
        Inspection inspection = inspectionMapper.selectById(inspectionId);
        if (inspection == null || !tenantId.equals(inspection.getTenantId())) {
            // 越权与不存在都返 404：区分开等于告诉调用方"这条检测单存在，只是不属于你"
            throw new BusinessException(404, "检测单不存在：" + inspectionId);
        }
        return inspection;
    }

    private TestingLab getOwnedLab(Long labId, String tenantId) {
        TestingLab lab = labMapper.selectById(labId);
        if (lab == null || !tenantId.equals(lab.getTenantId())) {
            throw new BusinessException(404, "检测机构不存在：" + labId);
        }
        return lab;
    }

    private QualityGradeRule getOwnedRule(Long ruleId, String tenantId) {
        QualityGradeRule rule = gradeRuleMapper.selectById(ruleId);
        if (rule == null || !tenantId.equals(rule.getTenantId())) {
            throw new BusinessException(404, "分级规则不存在：" + ruleId);
        }
        return rule;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void applyDto(Inspection inspection, InspectionSaveDTO dto) {
        if (dto.getInspectionNo() != null && !dto.getInspectionNo().isBlank()) {
            inspection.setInspectionNo(dto.getInspectionNo().trim());
        }
        if (dto.getBatchId() != null) {
            inspection.setBatchId(toLong(dto.getBatchId()));
        }
        if (dto.getBatchNo() != null) {
            inspection.setBatchNo(trimToNull(dto.getBatchNo()));
        }
        if (dto.getPlotId() != null) {
            inspection.setPlotId(toLong(dto.getPlotId()));
        }
        if (dto.getCropId() != null) {
            inspection.setCropId(toLong(dto.getCropId()));
        }
        if (dto.getCropName() != null) {
            inspection.setCropName(trimToNull(dto.getCropName()));
        }
        if (dto.getInspectionType() != null) {
            inspection.setInspectionType(trimToNull(dto.getInspectionType()));
        }
        if (dto.getInspectorId() != null) {
            inspection.setInspectorId(toLong(dto.getInspectorId()));
        }
        if (dto.getInspectorName() != null) {
            inspection.setInspectorName(trimToNull(dto.getInspectorName()));
        }
        if (dto.getSampleQty() != null) {
            inspection.setSampleQty(dto.getSampleQty());
        }
        if (dto.getSampleAt() != null && !dto.getSampleAt().isBlank()) {
            inspection.setSampleAt(parseDateTime(dto.getSampleAt()));
        }
        if (dto.getResult() != null) {
            inspection.setResult(normalizeResult(dto.getResult()));
        }
        if (dto.getReportUrl() != null) {
            inspection.setReportUrl(trimToNull(dto.getReportUrl()));
        }
        if (dto.getStatus() != null && !dto.getStatus().isBlank()) {
            inspection.setStatus(normalizeStatus(dto.getStatus()));
        }
        if (dto.getLabId() != null) {
            inspection.setLabId(toLong(dto.getLabId()));
        }
        if (dto.getLabName() != null) {
            inspection.setLabName(trimToNull(dto.getLabName()));
        }
        if (dto.getOnChain() != null) {
            inspection.setOnChain(dto.getOnChain());
        }
        if (dto.getRemark() != null) {
            inspection.setRemark(trimToNull(dto.getRemark()));
        }

        Long farmId = toLong(dto.getFarmId());
        if (farmId != null) {
            inspection.setFarmId(farmId);
        } else if (inspection.getFarmId() == null && inspection.getPlotId() != null) {
            // 页面不一定下发 farmId，但地块给了就能推出来（可推导，不是编数据）
            Plot plot = plotMapper.selectById(inspection.getPlotId());
            if (plot != null) {
                inspection.setFarmId(plot.getFarmId());
                if (inspection.getCropName() == null && plot.getCurrentCrop() != null) {
                    inspection.setCropName(plot.getCurrentCrop());
                }
            }
        }
    }

    /**
     * 结论与状态必须自洽。
     *
     * <p>有 PASS/FAIL 结论就不该还是 PENDING：页面上"结论"与"状态"是两列分开渲染的，
     * 出现"结论：合格 / 状态：待检"这种行，用户第一反应是数据错了。</p>
     */
    private void alignResultAndStatus(Inspection inspection) {
        boolean hasResult = RESULT_PASS.equals(inspection.getResult()) || RESULT_FAIL.equals(inspection.getResult());
        if (hasResult && STATUS_PENDING.equals(inspection.getStatus())) {
            inspection.setStatus(STATUS_DONE);
        }
    }

    private String normalizeResult(String result) {
        if (result == null || result.isBlank()) {
            return null;
        }
        String value = result.trim().toUpperCase();
        return RESULT_PASS.equals(value) || RESULT_FAIL.equals(value) ? value : null;
    }

    private String normalizeStatus(String status) {
        String value = status.trim().toUpperCase();
        switch (value) {
            case STATUS_PENDING:
            case STATUS_TESTING:
            case STATUS_DONE:
                return value;
            default:
                throw new BusinessException(400, "未知的检测单状态：" + status + "（PENDING / TESTING / DONE）");
        }
    }

    private String nextInspectionNo(String tenantId) {
        String day = LocalDate.now().format(CODE_DAY);
        for (int i = 0; i < 8; i++) {
            String no = "QC" + day + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = inspectionMapper.selectCount(new LambdaQueryWrapper<Inspection>()
                    .eq(Inspection::getTenantId, tenantId)
                    .eq(Inspection::getInspectionNo, no));
            if (used == null || used == 0) {
                return no;
            }
        }
        throw new BusinessException(500, "生成检测单号失败，请稍后重试");
    }

    private String nextLabCode(String tenantId) {
        for (int i = 0; i < 8; i++) {
            String code = "LAB-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = labMapper.selectCount(new LambdaQueryWrapper<TestingLab>()
                    .eq(TestingLab::getTenantId, tenantId)
                    .eq(TestingLab::getLabCode, code));
            if (used == null || used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成机构编码失败，请稍后重试");
    }

    /**
     * 日期入参：支持 ISO（带 T）与 {@code yyyy-MM-dd[ HH:mm:ss]}。
     *
     * <p>只给日期时按整日边界处理：起始取当天 00:00，结束取当天 23:59:59.999999999 ——
     * 否则"结束日期 = 今天"会把今天抽样的检测单全过滤掉（页面按日期区间筛选时最容易踩）。</p>
     */
    private LocalDateTime parseDateTimeOrNull(String value, boolean startOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        LocalDateTime parsed = parseDateTime(text);
        if (text.length() <= 10) {
            return startOfDay ? parsed : parsed.plusDays(1).minusNanos(1);
        }
        return parsed;
    }

    private LocalDateTime parseDateTime(String value) {
        String text = value.trim();
        try {
            return LocalDateTime.parse(text.contains("T") ? text : text.replace(' ', 'T'));
        } catch (DateTimeParseException e) {
            try {
                return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text).atStartOfDay();
            } catch (DateTimeParseException ignored) {
                throw new BusinessException(400, "时间格式不正确：" + value + "（应为 yyyy-MM-dd HH:mm:ss）");
            }
        }
    }

    private static Long toLong(String value) {
        String text = trimToNull(value);
        if (text == null) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }
}
