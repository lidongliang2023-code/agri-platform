package com.agri.production.service.impl;

import com.agri.production.common.constant.AlertDict;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IUserAlertService;
import com.agri.production.vo.UserAlertVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户端告警中心实现。
 *
 * <p>库内的级别/状态是英文串且两代词表并存，所有比较都经 {@link AlertDict} 走 IN 列表 ——
 * 这是这段代码里最容易写错、也最难在页面上发现的地方（EQ 查不到数据时页面只是"少几条"）。</p>
 */
@Slf4j
@Service
public class UserAlertServiceImpl implements IUserAlertService {

    private static final int KEYWORD_MAX_LENGTH = 64;

    private final AlertRecordMapper alertMapper;
    private final FarmIdResolver farmIdResolver;

    public UserAlertServiceImpl(AlertRecordMapper alertMapper, FarmIdResolver farmIdResolver) {
        this.alertMapper = alertMapper;
        this.farmIdResolver = farmIdResolver;
    }

    @Override
    public PageResult<UserAlertVO> page(int pageNum, int pageSize, String tenantId, String farmId, Integer alertLevel,
                                       Integer alertSource, Integer status, String keyword, String startDate,
                                       String endDate) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<AlertRecord> w = baseWrapper(tenantId);
        applyFilters(w, tenantId, farmId, alertLevel, alertSource, status, keyword, startDate, endDate);
        // 触发时间倒序；同秒的按 id 倒序兜底，避免分页串行
        w.orderByDesc(AlertRecord::getCreateTime).orderByDesc(AlertRecord::getId);
        Page<AlertRecord> page = alertMapper.selectPage(new Page<>(p, s), w);
        List<UserAlertVO> rows = page.getRecords().stream().map(UserAlertVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    public List<UserAlertVO> unhandled(String tenantId, String farmId) {
        LambdaQueryWrapper<AlertRecord> w = baseWrapper(tenantId)
                .in(AlertRecord::getStatus, AlertDict.statusValuesOf(AlertDict.STATUS_PENDING));
        if (farmId != null && !farmId.isBlank()) {
            Long local = farmIdResolver.resolveFilter(farmId, tenantId);
            if (local != null) {
                w.eq(AlertRecord::getFarmId, local);
            }
        }
        w.orderByDesc(AlertRecord::getCreateTime).orderByDesc(AlertRecord::getId);
        return alertMapper.selectList(w).stream().map(UserAlertVO::of).toList();
    }

    @Override
    public Map<String, Object> stats(String tenantId, String farmId) {
        Long localFarmId = farmId == null || farmId.isBlank() ? null : farmIdResolver.resolveFilter(farmId, tenantId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", countByStatus(tenantId, localFarmId, null));
        result.put("unhandled", countByStatus(tenantId, localFarmId, AlertDict.STATUS_PENDING));
        result.put("handling", countByStatus(tenantId, localFarmId, AlertDict.STATUS_HANDLING));
        result.put("resolved", countByStatus(tenantId, localFarmId, AlertDict.STATUS_HANDLED));
        result.put("ignored", countByStatus(tenantId, localFarmId, AlertDict.STATUS_IGNORED));
        List<Map<String, Object>> levelCounts = new ArrayList<>();
        for (int level = AlertDict.LEVEL_INFO; level <= AlertDict.LEVEL_URGENT; level++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("level", level);
            item.put("count", countByLevel(tenantId, localFarmId, level));
            levelCounts.add(item);
        }
        result.put("levelCounts", levelCounts);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserAlertVO handle(String tenantId, String alertId, Integer status, String handleRemark) {
        if (status == null || status < AlertDict.STATUS_PENDING || status > AlertDict.STATUS_IGNORED) {
            throw new BusinessException(400, "告警状态应为 1 未处理 / 2 处理中 / 3 已处理 / 4 已忽略："
                    + (status == null ? "空" : status));
        }
        AlertRecord alert = requireAlert(tenantId, alertId);
        alert.setStatus(AlertDict.statusTextOf(status));
        alert.setHandleTime(LocalDateTime.now());
        if (handleRemark != null && !handleRemark.isBlank()) {
            alert.setHandleResult(handleRemark.trim());
        }
        alert.setUpdateTime(LocalDateTime.now());
        alertMapper.updateById(alert);
        log.info("告警处置：{} → {}（{}）", alert.getAlertCode(), alert.getStatus(), handleRemark);
        return UserAlertVO.of(alertMapper.selectById(alert.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int ignore(String tenantId, List<String> alertIds) {
        List<String> codes = alertIds == null ? List.of() : alertIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        if (codes.isEmpty()) {
            throw new BusinessException(400, "请选择要忽略的告警");
        }
        List<AlertRecord> hits = alertMapper.selectList(baseWrapper(tenantId).in(AlertRecord::getAlertCode, codes));
        // 有一条对不上就整批不动：部分成功的批量操作会让人不知道到底忽略了几条
        if (hits.size() != codes.size()) {
            List<String> found = hits.stream().map(AlertRecord::getAlertCode).toList();
            List<String> missing = codes.stream().filter(code -> !found.contains(code)).toList();
            throw new BusinessException(400, "这些告警不存在或不属于当前租户：" + missing);
        }
        int updated = 0;
        LocalDateTime now = LocalDateTime.now();
        for (AlertRecord alert : hits) {
            if (AlertDict.codeOfStatus(alert.getStatus()) == AlertDict.STATUS_IGNORED) {
                continue;
            }
            alert.setStatus(AlertDict.statusTextOf(AlertDict.STATUS_IGNORED));
            alert.setHandleTime(now);
            alert.setUpdateTime(now);
            alertMapper.updateById(alert);
            updated++;
        }
        log.info("告警批量忽略：{} 条（请求 {} 条）", updated, codes.size());
        return updated;
    }

    /* ==================== 内部工具 ==================== */

    private LambdaQueryWrapper<AlertRecord> baseWrapper(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法查询告警");
        }
        return new LambdaQueryWrapper<AlertRecord>().eq(AlertRecord::getTenantId, tenantId);
    }

    private void applyFilters(LambdaQueryWrapper<AlertRecord> w, String tenantId, String farmId, Integer alertLevel,
                              Integer alertSource, Integer status, String keyword, String startDate, String endDate) {
        if (farmId != null && !farmId.isBlank()) {
            // 页面传的是"当前农场"编号（来自仍在平台侧的 /farms 段，形如 DEMO-FARM-001），
            // 本表存的是本服务农场主键 —— 必须换算，否则筛选静默失效（见 FarmIdResolver 的注释）
            Long local = farmIdResolver.resolveFilter(farmId, tenantId);
            if (local != null) {
                w.eq(AlertRecord::getFarmId, local);
            }
        }
        if (alertLevel != null) {
            w.in(AlertRecord::getLevel, AlertDict.levelValuesOf(alertLevel));
        }
        if (status != null) {
            w.in(AlertRecord::getStatus, AlertDict.statusValuesOf(status));
        }
        if (alertSource != null) {
            w.eq(AlertRecord::getSourceType, sourceTextOf(alertSource));
        }
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            if (kw.length() > KEYWORD_MAX_LENGTH) {
                throw new BusinessException(400, "关键字不得超过 " + KEYWORD_MAX_LENGTH + " 字");
            }
            w.and(q -> q.like(AlertRecord::getTitle, kw)
                    .or().like(AlertRecord::getContent, kw)
                    .or().like(AlertRecord::getAlertCode, kw));
        }
        LocalDate from = parseDate(startDate, "开始日期");
        LocalDate to = parseDate(endDate, "结束日期");
        if (from != null) {
            w.ge(AlertRecord::getCreateTime, from.atStartOfDay());
        }
        if (to != null) {
            // 结束日期按"含当天"处理：< 次日 00:00，否则选当天会一条都查不到
            w.lt(AlertRecord::getCreateTime, to.plusDays(1).atStartOfDay());
        }
    }

    /** 来源数字编码 → 库内文案（与 AlertDict.codeOfSource 互为反向）。 */
    private String sourceTextOf(int sourceCode) {
        return switch (sourceCode) {
            case 2 -> "device";
            case 3 -> "pest";
            case 4 -> "task";
            case 5 -> "input";
            default -> "environment";
        };
    }

    private LocalDate parseDate(String text, String field) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + "格式应为 yyyy-MM-dd：" + text);
        }
    }

    private long countByStatus(String tenantId, Long farmId, Integer statusCode) {
        LambdaQueryWrapper<AlertRecord> w = baseWrapper(tenantId);
        if (farmId != null) {
            w.eq(AlertRecord::getFarmId, farmId);
        }
        if (statusCode != null) {
            w.in(AlertRecord::getStatus, AlertDict.statusValuesOf(statusCode));
        }
        Long hits = alertMapper.selectCount(w);
        return hits == null ? 0L : hits;
    }

    private long countByLevel(String tenantId, Long farmId, int levelCode) {
        LambdaQueryWrapper<AlertRecord> w = baseWrapper(tenantId)
                .in(AlertRecord::getLevel, AlertDict.levelValuesOf(levelCode));
        if (farmId != null) {
            w.eq(AlertRecord::getFarmId, farmId);
        }
        Long hits = alertMapper.selectCount(w);
        return hits == null ? 0L : hits;
    }

    private AlertRecord requireAlert(String tenantId, String alertId) {
        if (alertId == null || alertId.isBlank()) {
            throw new BusinessException(400, "缺少告警编号");
        }
        AlertRecord alert = alertMapper.selectOne(baseWrapper(tenantId)
                .eq(AlertRecord::getAlertCode, alertId.trim())
                .last("LIMIT 1"));
        if (alert == null) {
            throw new BusinessException(404, "告警不存在：" + alertId.trim());
        }
        return alert;
    }
}
