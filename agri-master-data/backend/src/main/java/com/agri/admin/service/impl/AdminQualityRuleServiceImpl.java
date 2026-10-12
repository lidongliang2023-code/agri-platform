package com.agri.admin.service.impl;

import com.agri.admin.dto.QualityRuleSaveDTO;
import com.agri.admin.dto.QualityTaskSaveDTO;
import com.agri.admin.service.IAdminQualityRuleService;
import com.agri.admin.vo.QualityRuleVO;
import com.agri.admin.vo.QualityTaskVO;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.masterdata.entity.QualityIssue;
import com.agri.masterdata.entity.QualityRule;
import com.agri.masterdata.entity.QualityTask;
import com.agri.masterdata.entity.QualityTaskRule;
import com.agri.masterdata.mapper.QualityIssueMapper;
import com.agri.masterdata.mapper.QualityRuleMapper;
import com.agri.masterdata.mapper.QualityTaskMapper;
import com.agri.masterdata.mapper.QualityTaskRuleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 质量规则与检测任务。
 *
 * <p>这两个页面原先的数据全在浏览器内存里（写死的 mock 数组），
 * 新增/修改/删除刷新即失效，后端也没有对应接口。</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminQualityRuleServiceImpl implements IAdminQualityRuleService {

    private final QualityRuleMapper qualityRuleMapper;
    private final QualityTaskMapper qualityTaskMapper;
    private final QualityTaskRuleMapper qualityTaskRuleMapper;
    private final QualityIssueMapper qualityIssueMapper;

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /* ---------------------------------- 规则 ---------------------------------- */

    @Override
    public List<QualityRuleVO> getRuleList(String ruleType, String status, String keyword) {
        LambdaQueryWrapper<QualityRule> wrapper = new LambdaQueryWrapper<>();
        if (ruleType != null && !ruleType.isEmpty()) {
            wrapper.eq(QualityRule::getRuleType, ruleType);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(QualityRule::getStatus, Integer.valueOf(status));
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(QualityRule::getRuleCode, keyword).or().like(QualityRule::getRuleName, keyword));
        }
        wrapper.orderByAsc(QualityRule::getRuleCode);

        List<QualityRuleVO> list = new ArrayList<>();
        for (QualityRule rule : qualityRuleMapper.selectList(wrapper)) {
            list.add(toRuleVO(rule));
        }
        return list;
    }

    @Override
    @Transactional
    public void createRule(QualityRuleSaveDTO dto) {
        if (dto.getRuleCode() == null || dto.getRuleCode().isEmpty()) {
            throw new BusinessException("规则编码不能为空");
        }
        Long exists = qualityRuleMapper.selectCount(
                new LambdaQueryWrapper<QualityRule>().eq(QualityRule::getRuleCode, dto.getRuleCode()));
        if (exists != null && exists > 0) {
            throw new BusinessException("规则编码已存在：" + dto.getRuleCode());
        }
        QualityRule rule = new QualityRule();
        rule.setRuleCode(dto.getRuleCode());
        rule.setDelFlag(0);
        applyRuleDto(rule, dto);
        rule.setStatus(dto.getStatus() == null ? 1 : dto.getStatus());
        qualityRuleMapper.insert(rule);
    }

    @Override
    @Transactional
    public void updateRule(Long id, QualityRuleSaveDTO dto) {
        QualityRule rule = qualityRuleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("质量规则不存在");
        }
        // 只覆盖本次传了的字段：启停开关只带 status
        applyRuleDto(rule, dto);
        if (dto.getStatus() != null) {
            rule.setStatus(dto.getStatus());
        }
        qualityRuleMapper.updateById(rule);
    }

    @Override
    @Transactional
    public void deleteRule(Long id) {
        QualityRule rule = qualityRuleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("质量规则不存在");
        }
        // 被任务引用的规则不允许直接删：删掉后任务的"检测规则"列会变成空的，
        // 而且历史问题上的 rule_id 会指向一条不存在的规则。
        Long used = qualityTaskRuleMapper.selectCount(
                new LambdaQueryWrapper<QualityTaskRule>().eq(QualityTaskRule::getRuleId, id));
        if (used != null && used > 0) {
            throw new BusinessException("该规则已被 " + used + " 个检测任务引用，请先从任务中移除");
        }
        qualityRuleMapper.deleteById(id);
    }

    /* ---------------------------------- 任务 ---------------------------------- */

    @Override
    public List<QualityTaskVO> getTaskList(String status, String keyword) {
        LambdaQueryWrapper<QualityTask> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq(QualityTask::getStatus, status);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(QualityTask::getTaskCode, keyword).or().like(QualityTask::getTaskName, keyword));
        }
        wrapper.orderByAsc(QualityTask::getTaskCode);

        List<QualityTask> tasks = qualityTaskMapper.selectList(wrapper);
        // 一次把这些任务的规则关联捞回来，避免每个任务查一次（N+1）
        Map<Long, List<Long>> taskRuleMap = new HashMap<>();
        if (!tasks.isEmpty()) {
            List<Long> taskIds = new ArrayList<>();
            tasks.forEach(t -> taskIds.add(t.getId()));
            for (QualityTaskRule link : qualityTaskRuleMapper.selectList(
                    new LambdaQueryWrapper<QualityTaskRule>().in(QualityTaskRule::getTaskId, taskIds))) {
                taskRuleMap.computeIfAbsent(link.getTaskId(), k -> new ArrayList<>()).add(link.getRuleId());
            }
        }

        Map<Long, String> ruleNames = new HashMap<>();
        qualityRuleMapper.selectList(null).forEach(r -> ruleNames.put(r.getId(), r.getRuleName()));

        List<QualityTaskVO> list = new ArrayList<>();
        for (QualityTask task : tasks) {
            QualityTaskVO vo = toTaskVO(task);
            List<Long> ruleIds = taskRuleMap.getOrDefault(task.getId(), new ArrayList<>());
            vo.setRuleIds(ruleIds);
            List<String> names = new ArrayList<>();
            ruleIds.forEach(rid -> {
                if (ruleNames.containsKey(rid)) {
                    names.add(ruleNames.get(rid));
                }
            });
            vo.setRuleNames(names);
            list.add(vo);
        }
        return list;
    }

    @Override
    @Transactional
    public void createTask(QualityTaskSaveDTO dto) {
        if (dto.getTaskCode() == null || dto.getTaskCode().isEmpty()) {
            throw new BusinessException("任务编码不能为空");
        }
        Long exists = qualityTaskMapper.selectCount(
                new LambdaQueryWrapper<QualityTask>().eq(QualityTask::getTaskCode, dto.getTaskCode()));
        if (exists != null && exists > 0) {
            throw new BusinessException("任务编码已存在：" + dto.getTaskCode());
        }
        QualityTask task = new QualityTask();
        task.setTaskCode(dto.getTaskCode());
        task.setDelFlag(0);
        task.setRunCount(0);
        applyTaskDto(task, dto);
        if (task.getStatus() == null) {
            task.setStatus("scheduled");
        }
        qualityTaskMapper.insert(task);
        replaceTaskRules(task.getId(), dto.getRuleIds());
    }

    @Override
    @Transactional
    public void updateTask(Long id, QualityTaskSaveDTO dto) {
        QualityTask task = qualityTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("检测任务不存在");
        }
        applyTaskDto(task, dto);
        qualityTaskMapper.updateById(task);
        if (dto.getRuleIds() != null) {
            replaceTaskRules(id, dto.getRuleIds());
        }
    }

    @Override
    @Transactional
    public void deleteTask(Long id) {
        QualityTask task = qualityTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("检测任务不存在");
        }
        replaceTaskRules(id, new ArrayList<>());
        qualityTaskMapper.deleteById(id);
    }

    @Override
    @Transactional
    public QualityTaskVO runTask(Long id) {
        QualityTask task = qualityTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("检测任务不存在");
        }

        List<Long> ruleIds = new ArrayList<>();
        for (QualityTaskRule link : qualityTaskRuleMapper.selectList(
                new LambdaQueryWrapper<QualityTaskRule>().eq(QualityTaskRule::getTaskId, id))) {
            ruleIds.add(link.getRuleId());
        }

        // 该任务下各规则当前未解决的问题数 —— 这是真查库的数字，
        // 不是"跑了一遍检测引擎"的结果（引擎尚未实现，见接口注释）。
        long openIssues = 0;
        if (!ruleIds.isEmpty()) {
            openIssues = qualityIssueMapper.selectCount(
                    new LambdaQueryWrapper<QualityIssue>()
                            .in(QualityIssue::getRuleId, ruleIds)
                            .in(QualityIssue::getStatus, List.of("pending", "processing")));
        }

        task.setLastRunTime(LocalDateTime.now());
        task.setLastSuccessCount(ruleIds.size());
        task.setLastFailCount((int) openIssues);
        task.setRunCount((task.getRunCount() == null ? 0 : task.getRunCount()) + 1);
        task.setStatus("completed");
        // successRate 刻意不写：没有执行引擎时"成功率"没有语义
        qualityTaskMapper.updateById(task);
        log.info("巡检触发：taskId={} operator={} rules={} openIssues={}",
                id, SecurityUtils.getUsername(), ruleIds.size(), openIssues);

        QualityTaskVO vo = toTaskVO(task);
        vo.setRuleIds(ruleIds);
        return vo;
    }

    /* --------------------------------- 内部方法 --------------------------------- */

    /** 整体替换某任务的规则集合（先清后插，避免出现"漏删一条"的半更新状态） */
    private void replaceTaskRules(Long taskId, List<Long> ruleIds) {
        qualityTaskRuleMapper.delete(
                new LambdaQueryWrapper<QualityTaskRule>().eq(QualityTaskRule::getTaskId, taskId));
        if (ruleIds == null || ruleIds.isEmpty()) {
            return;
        }
        Set<Long> distinct = new LinkedHashSet<>(ruleIds);
        for (Long ruleId : distinct) {
            QualityTaskRule link = new QualityTaskRule();
            link.setTaskId(taskId);
            link.setRuleId(ruleId);
            link.setStatus(1);
            link.setDelFlag(0);
            qualityTaskRuleMapper.insert(link);
        }
    }

    private void applyRuleDto(QualityRule rule, QualityRuleSaveDTO dto) {
        if (dto.getRuleName() != null) rule.setRuleName(dto.getRuleName());
        if (dto.getRuleType() != null) rule.setRuleType(dto.getRuleType());
        if (dto.getDescription() != null) rule.setDescription(dto.getDescription());
        if (dto.getTargetDomain() != null) rule.setTargetDomain(dto.getTargetDomain());
        if (dto.getTargetTable() != null) rule.setTargetTable(dto.getTargetTable());
        if (dto.getTargetField() != null) rule.setTargetField(dto.getTargetField());
        if (dto.getExpression() != null) rule.setExpression(dto.getExpression());
        if (dto.getThreshold() != null) rule.setThreshold(dto.getThreshold());
        if (dto.getSeverity() != null) rule.setSeverity(dto.getSeverity());
    }

    private void applyTaskDto(QualityTask task, QualityTaskSaveDTO dto) {
        if (dto.getTaskName() != null) task.setTaskName(dto.getTaskName());
        if (dto.getTaskType() != null) task.setTaskType(dto.getTaskType());
        if (dto.getCronExpression() != null) task.setCronExpression(dto.getCronExpression());
        if (dto.getStatus() != null) task.setStatus(dto.getStatus());
    }

    private QualityRuleVO toRuleVO(QualityRule rule) {
        QualityRuleVO vo = new QualityRuleVO();
        vo.setId(rule.getId());
        vo.setRuleCode(rule.getRuleCode());
        vo.setRuleName(rule.getRuleName());
        vo.setRuleType(rule.getRuleType());
        vo.setDescription(rule.getDescription());
        vo.setTargetDomain(rule.getTargetDomain());
        vo.setTargetTable(rule.getTargetTable());
        vo.setTargetField(rule.getTargetField());
        vo.setExpression(rule.getExpression());
        vo.setThreshold(rule.getThreshold());
        vo.setSeverity(rule.getSeverity());
        vo.setStatus(rule.getStatus());
        vo.setCreateTime(rule.getCreateTime() == null ? null : rule.getCreateTime().format(DATETIME_FMT));
        return vo;
    }

    private QualityTaskVO toTaskVO(QualityTask task) {
        QualityTaskVO vo = new QualityTaskVO();
        vo.setId(task.getId());
        vo.setTaskCode(task.getTaskCode());
        vo.setTaskName(task.getTaskName());
        vo.setTaskType(task.getTaskType());
        vo.setCronExpression(task.getCronExpression());
        vo.setStatus(task.getStatus());
        vo.setLastRunTime(task.getLastRunTime() == null ? null : task.getLastRunTime().format(DATETIME_FMT));
        vo.setNextRunTime(task.getNextRunTime() == null ? null : task.getNextRunTime().format(DATETIME_FMT));
        vo.setLastSuccessCount(task.getLastSuccessCount());
        vo.setLastFailCount(task.getLastFailCount());
        vo.setSuccessRate(task.getSuccessRate());
        vo.setRunCount(task.getRunCount());
        vo.setCreateTime(task.getCreateTime() == null ? null : task.getCreateTime().format(DATETIME_FMT));
        return vo;
    }
}
