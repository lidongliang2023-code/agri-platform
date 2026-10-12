package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminQualityService;
import com.agri.admin.dto.QualityIssueSaveDTO;
import com.agri.admin.vo.QualityDetailVO;
import com.agri.admin.vo.QualityIssueVO;
import com.agri.admin.vo.QualityStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.masterdata.entity.QualityIssue;
import com.agri.masterdata.entity.QualityIssueHandle;
import com.agri.masterdata.mapper.QualityIssueHandleMapper;
import com.agri.masterdata.mapper.QualityIssueMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 数据质量管理。
 *
 * <p>本类原来六个方法全是空壳：统计返回 builder 写死的数字（总数 10、严重 2…）、
 * 列表恒返回空数组、详情返回一条 "测试数据质量问题"、处置是空方法体。
 * 于是质量监控、问题工单、质量仪表盘三个页面无论怎么操作都看不到数据。
 * 现在全部落到 agri_md_quality_issue（+ 处置记录表）。</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminQualityServiceImpl implements IAdminQualityService {

    private final QualityIssueMapper qualityIssueMapper;
    private final QualityIssueHandleMapper qualityIssueHandleMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public QualityStatisticsVO getQualityStatistics(String tenantId, String timeRange) {
        LambdaQueryWrapper<QualityIssue> base = buildFilter(null, null, null, tenantId);

        long total = qualityIssueMapper.selectCount(base);
        QualityStatisticsVO vo = QualityStatisticsVO.builder()
                .totalIssues(total)
                .highSeverityCount(countWith(tenantId, "severity", "high"))
                .mediumSeverityCount(countWith(tenantId, "severity", "medium"))
                .lowSeverityCount(countWith(tenantId, "severity", "low"))
                .pendingCount(countWith(tenantId, "status", "pending"))
                .resolvedCount(countWith(tenantId, "status", "resolved"))
                .build();

        // 兼容前端历史上用过的字段名：critical/major/minor 与 high/medium/low 是同一批数据
        vo.setCriticalIssues(vo.getHighSeverityCount());
        vo.setMajorIssues(vo.getMediumSeverityCount());
        vo.setMinorIssues(vo.getLowSeverityCount());
        vo.setResolvedIssues(vo.getResolvedCount());
        vo.setResolutionRate(total == 0 ? null
                : Math.round(vo.getResolvedCount() * 10000.0 / total) / 100.0);

        // 质量评分需要质量规则与评分模型，当前没有数据来源 —— 留空而不是编一个 96.8
        vo.setOverallScore(null);
        vo.setDomainStatistics(buildDomainStatistics(tenantId));
        vo.setDomainQualities(new ArrayList<>());
        vo.setQualityTrend(getQualityTrend(timeRange, null));
        vo.setTrends(vo.getQualityTrend());
        return vo;
    }

    @Override
    public PageResult<QualityIssueVO> getQualityIssues(Integer pageNum, Integer pageSize, String severity,
                                                       String domain, String status, String tenantId) {
        LambdaQueryWrapper<QualityIssue> wrapper = buildFilter(severity, domain, status, tenantId);
        wrapper.orderByDesc(QualityIssue::getDetectTime).orderByDesc(QualityIssue::getId);

        IPage<QualityIssue> page = qualityIssueMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<QualityIssueVO> list = new ArrayList<>();
        for (QualityIssue issue : page.getRecords()) {
            list.add(toIssueVO(issue));
        }
        return PageResult.success(list, page.getTotal(), pageNum, pageSize);
    }

    @Override
    @Transactional
    public void createQualityIssue(QualityIssueSaveDTO dto) {
        if (dto.getDescription() == null || dto.getDescription().isEmpty()) {
            throw new BusinessException("问题描述不能为空");
        }
        QualityIssue issue = new QualityIssue();
        // 问题编码由服务端生成：QI-yyyyMMdd-序号。让前端拼编码会出现
        // "同一天两个人同时登记拿到同一个编号"的并发问题。
        String day = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long todayCount = qualityIssueMapper.selectCount(
                new LambdaQueryWrapper<QualityIssue>().likeRight(QualityIssue::getIssueCode, "QI-" + day + "-"));
        issue.setIssueCode(String.format("QI-%s-%03d", day, todayCount + 1));
        issue.setIssueType(dto.getIssueType() == null ? "manual" : dto.getIssueType());
        issue.setSeverity(dto.getSeverity() == null ? "medium" : dto.getSeverity());
        issue.setDomainCode(dto.getDomainCode());
        issue.setDomainName(dto.getDomainName());
        issue.setDescription(dto.getDescription());
        issue.setAffectedData(dto.getAffectedData());
        issue.setAffectedRecords(dto.getAffectedRecords());
        issue.setStatus("pending");
        issue.setDetectTime(LocalDateTime.now());
        issue.setTenantId(dto.getTenantId());
        issue.setDelFlag(0);
        qualityIssueMapper.insert(issue);
    }

    @Override
    public QualityDetailVO getQualityDetail(Long id) {
        QualityIssue issue = qualityIssueMapper.selectById(id);
        if (issue == null) {
            throw new BusinessException("质量问题不存在");
        }

        QualityDetailVO vo = new QualityDetailVO();
        vo.setId(issue.getId());
        vo.setIssueCode(issue.getIssueCode());
        vo.setIssueType(issue.getIssueType());
        vo.setSeverity(issue.getSeverity());
        vo.setDomain(issue.getDomainName());
        vo.setDomainCode(issue.getDomainCode());
        vo.setDescription(issue.getDescription());
        vo.setAffectedData(issue.getAffectedData());
        vo.setAffectedRecords(issue.getAffectedRecords());
        vo.setAffectedCount(issue.getAffectedRecords() == null ? null : issue.getAffectedRecords() + " 条");
        vo.setTenantId(issue.getTenantId());
        vo.setStatus(issue.getStatus());
        vo.setCreateTime(issue.getCreateTime() == null ? null : issue.getCreateTime().format(DATETIME_FMT));
        vo.setDetectedTime(issue.getDetectTime() == null ? null : issue.getDetectTime().format(DATETIME_FMT));
        vo.setLastUpdateTime(issue.getUpdateTime() == null ? null : issue.getUpdateTime().format(DATETIME_FMT));
        vo.setHandler(issue.getHandler());
        vo.setResolver(issue.getResolveTime() == null ? null : issue.getHandler());
        vo.setResolveTime(issue.getResolveTime() == null ? null : issue.getResolveTime().format(DATETIME_FMT));
        vo.setResolveRemark(issue.getResolveRemark());
        vo.setRemark(issue.getRemark());

        List<QualityDetailVO.HandleHistory> histories = new ArrayList<>();
        for (QualityIssueHandle handle : qualityIssueHandleMapper.selectList(
                new LambdaQueryWrapper<QualityIssueHandle>()
                        .eq(QualityIssueHandle::getIssueId, id)
                        .orderByDesc(QualityIssueHandle::getId))) {
            QualityDetailVO.HandleHistory history = new QualityDetailVO.HandleHistory();
            history.setTime(handle.getCreateTime() == null ? null : handle.getCreateTime().format(DATETIME_FMT));
            history.setOperator(handle.getOperator());
            history.setAction(handle.getAction());
            history.setRemark(handle.getRemark());
            histories.add(history);
        }
        vo.setHandleHistories(histories);
        return vo;
    }

    @Override
    @Transactional
    public void handleQualityIssue(Long id, String status, String remark) {
        QualityIssue issue = qualityIssueMapper.selectById(id);
        if (issue == null) {
            throw new BusinessException("质量问题不存在");
        }
        applyHandle(issue, status, remark);
        qualityIssueMapper.updateById(issue);
    }

    @Override
    @Transactional
    public void batchHandleQualityIssues(List<Long> ids, String status, String remark) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        // 先整批校验再整批写：若中间某条不存在就中断，已改的几条会留在"半处理"状态，
        // 而调用方以为整批要么全成要么全败。
        List<QualityIssue> issues = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (Long id : ids) {
            QualityIssue issue = qualityIssueMapper.selectById(id);
            if (issue == null) {
                missing.add(String.valueOf(id));
            } else {
                issues.add(issue);
            }
        }
        if (!missing.isEmpty()) {
            throw new BusinessException("以下质量问题不存在：" + String.join("、", missing));
        }
        for (QualityIssue issue : issues) {
            applyHandle(issue, status, remark);
            qualityIssueMapper.updateById(issue);
        }
    }

    @Override
    public List<QualityStatisticsVO.QualityTrend> getQualityTrend(String timeRange, String domain) {
        int days = parseDays(timeRange);
        LocalDate from = LocalDate.now().minusDays(days - 1L);

        LambdaQueryWrapper<QualityIssue> wrapper = new LambdaQueryWrapper<>();
        wrapper.ge(QualityIssue::getDetectTime, from.atStartOfDay());
        if (domain != null && !domain.isEmpty()) {
            wrapper.and(w -> w.eq(QualityIssue::getDomainCode, domain).or().eq(QualityIssue::getDomainName, domain));
        }

        // 按日期分桶。不写成 SQL 的 GROUP BY：这里要用 Java 的日期语义补齐"没有问题的日期"，
        // 否则折线图会缺一段，看起来像数据丢了。
        Map<String, long[]> buckets = new LinkedHashMap<>();
        for (int i = 0; i < days; i++) {
            buckets.put(from.plusDays(i).format(DATE_FMT), new long[]{0L, 0L});
        }
        for (QualityIssue issue : qualityIssueMapper.selectList(wrapper)) {
            if (issue.getDetectTime() == null) {
                continue;
            }
            String key = issue.getDetectTime().toLocalDate().format(DATE_FMT);
            long[] bucket = buckets.get(key);
            if (bucket == null) {
                continue;
            }
            bucket[0]++;
            if ("resolved".equals(issue.getStatus())) {
                bucket[1]++;
            }
        }

        List<QualityStatisticsVO.QualityTrend> trends = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : buckets.entrySet()) {
            QualityStatisticsVO.QualityTrend trend = new QualityStatisticsVO.QualityTrend();
            trend.setDate(entry.getKey());
            trend.setTotalIssues(entry.getValue()[0]);
            trend.setResolvedIssues(entry.getValue()[1]);
            trend.setAvgScore(null);
            trends.add(trend);
        }
        return trends;
    }

    @Override
    public byte[] exportQualityIssues(String severity, String status) {
        LambdaQueryWrapper<QualityIssue> wrapper = buildFilter(severity, null, status, null);
        wrapper.orderByDesc(QualityIssue::getDetectTime);

        StringBuilder csv = new StringBuilder();
        csv.append("问题编码,问题类型,严重程度,数据域,问题描述,关联数据,受影响记录数,处理状态,处理人,检测时间\n");
        for (QualityIssue issue : qualityIssueMapper.selectList(wrapper)) {
            csv.append(csvCell(issue.getIssueCode())).append(',')
                    .append(csvCell(issue.getIssueType())).append(',')
                    .append(csvCell(issue.getSeverity())).append(',')
                    .append(csvCell(issue.getDomainName())).append(',')
                    .append(csvCell(issue.getDescription())).append(',')
                    .append(csvCell(issue.getAffectedData())).append(',')
                    .append(issue.getAffectedRecords() == null ? "" : issue.getAffectedRecords()).append(',')
                    .append(csvCell(issue.getStatus())).append(',')
                    .append(csvCell(issue.getHandler())).append(',')
                    .append(issue.getDetectTime() == null ? "" : issue.getDetectTime().format(DATETIME_FMT))
                    .append('\n');
        }
        // 带 BOM：不带的话 Excel 打开中文列名会乱码
        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);
        return withBom;
    }

    /* --------------------------------- 内部方法 --------------------------------- */

    private LambdaQueryWrapper<QualityIssue> buildFilter(String severity, String domain, String status, String tenantId) {
        LambdaQueryWrapper<QualityIssue> wrapper = new LambdaQueryWrapper<>();
        if (severity != null && !severity.isEmpty()) {
            wrapper.eq(QualityIssue::getSeverity, severity);
        }
        if (domain != null && !domain.isEmpty()) {
            wrapper.and(w -> w.eq(QualityIssue::getDomainCode, domain).or().eq(QualityIssue::getDomainName, domain));
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(QualityIssue::getStatus, status);
        }
        if (tenantId != null && !tenantId.isEmpty()) {
            wrapper.eq(QualityIssue::getTenantId, tenantId);
        }
        return wrapper;
    }

    private long countWith(String tenantId, String field, String value) {
        LambdaQueryWrapper<QualityIssue> wrapper = new LambdaQueryWrapper<>();
        if ("severity".equals(field)) {
            wrapper.eq(QualityIssue::getSeverity, value);
        } else if ("status".equals(field)) {
            wrapper.eq(QualityIssue::getStatus, value);
        }
        if (tenantId != null && !tenantId.isEmpty()) {
            wrapper.eq(QualityIssue::getTenantId, tenantId);
        }
        return qualityIssueMapper.selectCount(wrapper);
    }

    private List<QualityStatisticsVO.DomainStatistics> buildDomainStatistics(String tenantId) {
        Map<String, QualityStatisticsVO.DomainStatistics> grouped = new LinkedHashMap<>();
        for (QualityIssue issue : qualityIssueMapper.selectList(buildFilter(null, null, null, tenantId))) {
            String code = issue.getDomainCode() == null ? "unknown" : issue.getDomainCode();
            QualityStatisticsVO.DomainStatistics stat = grouped.computeIfAbsent(code, key -> {
                QualityStatisticsVO.DomainStatistics item = new QualityStatisticsVO.DomainStatistics();
                item.setDomainCode(key);
                item.setDomainName(issue.getDomainName());
                item.setIssueCount(0L);
                return item;
            });
            stat.setIssueCount(stat.getIssueCount() + 1);
        }
        return new ArrayList<>(grouped.values());
    }

    /** 处置：改问题状态 + 追加一条处置记录 */
    private void applyHandle(QualityIssue issue, String status, String remark) {
        String operator = SecurityUtils.getUsername() == null ? "system" : SecurityUtils.getUsername();
        if (status != null && !status.isEmpty()) {
            issue.setStatus(status);
        }
        issue.setHandler(operator);
        if (remark != null) {
            issue.setResolveRemark(remark);
        }
        if ("resolved".equals(status) || "ignored".equals(status)) {
            issue.setResolveTime(LocalDateTime.now());
        }

        QualityIssueHandle handle = new QualityIssueHandle();
        handle.setIssueId(issue.getId());
        handle.setAction(status);
        handle.setOperator(operator);
        handle.setRemark(remark);
        handle.setStatus(1);
        handle.setDelFlag(0);
        qualityIssueHandleMapper.insert(handle);
    }

    private QualityIssueVO toIssueVO(QualityIssue issue) {
        QualityIssueVO vo = new QualityIssueVO();
        vo.setId(issue.getId());
        vo.setIssueCode(issue.getIssueCode());
        vo.setIssueType(issue.getIssueType());
        vo.setSeverity(issue.getSeverity());
        vo.setDomain(issue.getDomainName());
        vo.setDomainCode(issue.getDomainCode());
        vo.setDescription(issue.getDescription());
        vo.setAffectedData(issue.getAffectedData());
        vo.setTenantId(issue.getTenantId());
        vo.setStatus(issue.getStatus());
        vo.setHandler(issue.getHandler());
        vo.setCreateTime(issue.getCreateTime() == null ? null : issue.getCreateTime().format(DATETIME_FMT));
        vo.setLastUpdateTime(issue.getUpdateTime() == null ? null : issue.getUpdateTime().format(DATETIME_FMT));
        return vo;
    }

    /** timeRange 支持 7d / 30d / 90d 这类写法，认不出按 30 天 */
    private int parseDays(String timeRange) {
        if (timeRange == null || timeRange.isEmpty()) {
            return 30;
        }
        String digits = timeRange.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return 30;
        }
        int days = Integer.parseInt(digits);
        return (days <= 0 || days > 365) ? 30 : days;
    }

    private String csvCell(String value) {
        if (value == null) {
            return "";
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
