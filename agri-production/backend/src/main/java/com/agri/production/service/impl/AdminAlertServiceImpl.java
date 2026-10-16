package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.constant.AlertDict;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.EmergencyPlan;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.EmergencyPlanMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.IAdminAlertService;
import com.agri.production.vo.AdminAlertReviewVO;
import com.agri.production.vo.AdminEmergencyPlanVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端异常告警实现（关闭告警 / 应急预案 / 灾害复盘）。
 *
 * <p>这三块的端点**在 core-platform 里也不存在**：core 的 {@code /admin/alerts} 只有告警列表、
 * 规则、派单、统计，以及两个"名字像但不是一回事"的 GET —— {@code /emergency} 返回的是紧急**告警**、
 * {@code /review} 返回的是待复核**告警**。而前端页面是按**预案**与**复盘**的字段渲染的，
 * 也就是说这两个页面今天拿到的是形状不对的数据，字段全是 undefined。这里是按页面契约真正实现。</p>
 */
@Slf4j
@Service
public class AdminAlertServiceImpl implements IAdminAlertService {

    /** 已处置（与用户端 AlertServiceImpl 写的是同一个值；库里还有默认值 unhandled，两代词表并存） */
    private static final String ALERT_STATUS_HANDLED = "handled";
    /** 运营端写入的行统一挂演示租户 */
    private static final String DEFAULT_TENANT = "2001";
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AlertRecordMapper alertRecordMapper;
    private final EmergencyPlanMapper emergencyPlanMapper;
    private final PlotMapper plotMapper;

    public AdminAlertServiceImpl(AlertRecordMapper alertRecordMapper,
                                EmergencyPlanMapper emergencyPlanMapper,
                                PlotMapper plotMapper) {
        this.alertRecordMapper = alertRecordMapper;
        this.emergencyPlanMapper = emergencyPlanMapper;
        this.plotMapper = plotMapper;
    }

    /** 地块名一次查出来，避免逐行查库（地块表很小，但没必要 N+1） */
    private Map<Long, String> plotNames(List<Long> plotIds) {
        List<Long> ids = plotIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return plotMapper.selectList(new LambdaQueryWrapper<Plot>().in(Plot::getId, ids)).stream()
                .collect(java.util.stream.Collectors.toMap(Plot::getId, Plot::getPlotName, (a, b) -> a));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> closeAlert(Long alertId, String operator, String closeRemark) {
        AlertRecord alert = alertId == null ? null : alertRecordMapper.selectById(alertId);
        if (alert == null) {
            throw new BusinessException(404, "告警不存在：" + alertId);
        }
        alert.setStatus(ALERT_STATUS_HANDLED);
        alert.setHandleTime(LocalDateTime.now());
        if (operator != null && !operator.isBlank()) {
            alert.setHandleUser(operator.trim());
        }
        if (closeRemark != null && !closeRemark.isBlank()) {
            alert.setHandleResult(closeRemark.trim());
        }
        alert.setUpdateTime(LocalDateTime.now());
        alertRecordMapper.updateById(alert);
        log.info("告警关闭：id={} 操作人={} 说明={}", alertId, operator,
                closeRemark == null || closeRemark.isBlank() ? "（未填）" : closeRemark.trim());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("alertId", String.valueOf(alert.getId()));
        row.put("status", alert.getStatus());
        row.put("handleTime", alert.getHandleTime() == null ? null : DATE_TIME.format(alert.getHandleTime()));
        row.put("handleUser", alert.getHandleUser());
        row.put("handleResult", alert.getHandleResult());
        return row;
    }

    @Override
    public PageResult<AdminAlertReviewVO> pageAlerts(int pageNum, int pageSize, Integer status, Integer alertLevel) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<AlertRecord> w = new LambdaQueryWrapper<>();
        if (status != null) {
            w.in(AlertRecord::getStatus, statusTexts(status));
        }
        if (alertLevel != null) {
            w.in(AlertRecord::getLevel, levelTexts(alertLevel));
        }
        w.orderByDesc(AlertRecord::getCreateTime).orderByDesc(AlertRecord::getId);
        Page<AlertRecord> page = alertRecordMapper.selectPage(new Page<>(p, s), w);
        Map<Long, String> plots = plotNames(page.getRecords().stream().map(AlertRecord::getPlotId).toList());
        List<AdminAlertReviewVO> rows = page.getRecords().stream()
                .map(record -> AdminAlertReviewVO.of(record, plots.get(record.getPlotId())))
                .toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    /**
     * 页面用**数字编码**筛选，而库里是英文枚举 —— 必须把数字翻成库里的写法再查，
     * 否则「传数字永远筛不中」（core-platform 的注释里记着同一个坑）。
     *
     * <p>库内两代词表并存（旧：PENDING/HANDLING/HANDLED/IGNORED；新：unhandled/handling/handled/ignored），
     * 所以一律用 IN 两套写法，不用单值 EQ。</p>
     */
    private static List<String> statusTexts(int statusCode) {
        // 词表搬到 common/constant/AlertDict：用户端告警中心要用同一套（两边读同一张表，
        // 各写一份必然有一天只改一边）。这里保留方法名，只做转发。
        return AlertDict.statusValuesOf(statusCode);
    }

    private static List<String> levelTexts(int levelCode) {
        // 口径统一到 AlertDict：'critical' 由"紧急(4)"改为"严重(3)" —— 库内这批 critical 行
        // 来自平台侧演示集，平台自己的口径就是 CRITICAL→严重，以数据来源为准。
        // 影响：管理端按"严重"筛选现在能筛出这 2 条（此前筛不出），按"紧急"筛不再包含它们。
        return AlertDict.levelValuesOf(levelCode);
    }

    @Override
    public PageResult<AdminEmergencyPlanVO> pagePlans(int pageNum, int pageSize, String alertType, Integer status) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<EmergencyPlan> w = new LambdaQueryWrapper<>();
        if (alertType != null && !alertType.isBlank()) {
            w.eq(EmergencyPlan::getPlanType, alertType.trim());
        }
        if (status != null) {
            w.eq(EmergencyPlan::getIsEnabled, status == 0 ? 0 : 1);
        }
        w.orderByDesc(EmergencyPlan::getUpdateTime).orderByAsc(EmergencyPlan::getId);
        Page<EmergencyPlan> page = emergencyPlanMapper.selectPage(new Page<>(p, s), w);
        List<AdminEmergencyPlanVO> rows = page.getRecords().stream().map(AdminEmergencyPlanVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminEmergencyPlanVO createPlan(Map<String, Object> payload) {
        EmergencyPlan plan = new EmergencyPlan();
        plan.setPlanCode("EP-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        applyPlanPayload(plan, payload);
        if (plan.getPlanName() == null || plan.getPlanName().isBlank()) {
            throw new BusinessException(400, "预案名称不能为空");
        }
        plan.setIsEnabled(plan.getIsEnabled() == null ? 1 : plan.getIsEnabled());
        plan.setTenantId(DEFAULT_TENANT);
        plan.setCreateTime(LocalDateTime.now());
        plan.setUpdateTime(LocalDateTime.now());
        plan.setDeleted(0);
        emergencyPlanMapper.insert(plan);
        log.info("新建应急预案：id={} name={}", plan.getId(), plan.getPlanName());
        return AdminEmergencyPlanVO.of(emergencyPlanMapper.selectById(plan.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminEmergencyPlanVO updatePlan(Long planId, Map<String, Object> payload) {
        EmergencyPlan plan = planId == null ? null : emergencyPlanMapper.selectById(planId);
        if (plan == null) {
            throw new BusinessException(404, "应急预案不存在：" + planId);
        }
        applyPlanPayload(plan, payload);
        plan.setUpdateTime(LocalDateTime.now());
        emergencyPlanMapper.updateById(plan);
        return AdminEmergencyPlanVO.of(emergencyPlanMapper.selectById(planId));
    }

    /** 只覆盖 payload 里真的带了的字段：增量更新不该把没传的字段清空 */
    private void applyPlanPayload(EmergencyPlan plan, Map<String, Object> payload) {
        if (payload == null) {
            return;
        }
        if (payload.containsKey("planName")) {
            plan.setPlanName(str(payload.get("planName")));
        }
        if (payload.containsKey("alertType")) {
            plan.setPlanType(str(payload.get("alertType")));
        }
        if (payload.containsKey("responseLevel")) {
            plan.setAlertLevel(str(payload.get("responseLevel")));
        }
        if (payload.containsKey("process")) {
            plan.setSteps(str(payload.get("process")));
        }
        if (payload.containsKey("ownerName")) {
            plan.setResponsiblePerson(str(payload.get("ownerName")));
        }
        if (payload.containsKey("ownerPhone")) {
            plan.setContactInfo(str(payload.get("ownerPhone")));
        }
        if (payload.containsKey("status")) {
            plan.setIsEnabled(toInt(payload.get("status"), 1));
        }
    }

    @Override
    public PageResult<AdminAlertReviewVO> pageReviews(int pageNum, int pageSize, String disasterType) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        // 数据源是"已处置告警"：页面的行模型只认 alertId。
        // disasterType 这个筛选参数后端没有对应字段，**不静默套用别的列**（页面自己会提示「未接入」）。
        LambdaQueryWrapper<AlertRecord> w = new LambdaQueryWrapper<AlertRecord>()
                .eq(AlertRecord::getStatus, ALERT_STATUS_HANDLED)
                .orderByDesc(AlertRecord::getHandleTime)
                .orderByDesc(AlertRecord::getId);
        Page<AlertRecord> page = alertRecordMapper.selectPage(new Page<>(p, s), w);
        Map<Long, String> plots = plotNames(page.getRecords().stream().map(AlertRecord::getPlotId).toList());
        List<AdminAlertReviewVO> rows = page.getRecords().stream()
                .map(record -> AdminAlertReviewVO.of(record, plots.get(record.getPlotId())))
                .toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminAlertReviewVO createReview(Map<String, Object> payload) {
        // 如实拒绝，而不是"存进一张列表永远读不到的表"：这一页的列表来自已处置告警，
        // 独立复盘行不会出现在里面 —— 用户会看到"创建成功、列表没变化"。
        throw new BusinessException(400,
                "本部署没有独立的灾害复盘模型：本页列表数据源为「已处置告警」，"
                        + "新增的复盘不会出现在列表里。如需完整复盘模型，请先定产品口径（涉及列表数据源与页面字段）。");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminAlertReviewVO updateReview(Long alertId, Map<String, Object> payload) {
        AlertRecord alert = alertId == null ? null : alertRecordMapper.selectById(alertId);
        if (alert == null) {
            throw new BusinessException(404, "告警不存在：" + alertId);
        }
        // 页面只送一个字段：{handleProcess: 处置说明}，它读回来当 handleRemark
        String handleProcess = payload == null || payload.get("handleProcess") == null
                ? null : str(payload.get("handleProcess"));
        if (handleProcess != null) {
            alert.setHandleResult(handleProcess);
        }
        alert.setUpdateTime(LocalDateTime.now());
        alertRecordMapper.updateById(alert);
        log.info("复盘信息已保存（写到告警 {} 的处置结果）", alertId);
        return AdminAlertReviewVO.of(alertRecordMapper.selectById(alertId));
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer toInt(Object value, int fallback) {
        String text = str(value);
        if (text == null) {
            return fallback;
        }
        String normalized = text.endsWith(".0") ? text.substring(0, text.length() - 2) : text;
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

}
