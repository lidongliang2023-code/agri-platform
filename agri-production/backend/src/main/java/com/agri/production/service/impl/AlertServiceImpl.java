package com.agri.production.service.impl;

import com.agri.production.dto.AlertRecordQueryDTO;
import com.agri.production.dto.AlertRuleSaveDTO;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.AlertRule;
import com.agri.production.entity.EmergencyPlan;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.AlertRuleMapper;
import com.agri.production.mapper.EmergencyPlanMapper;
import com.agri.production.service.IAlertService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AlertServiceImpl implements IAlertService {

    private final AlertRuleMapper alertRuleMapper;
    private final AlertRecordMapper alertRecordMapper;
    private final EmergencyPlanMapper emergencyPlanMapper;

    public AlertServiceImpl(AlertRuleMapper alertRuleMapper, AlertRecordMapper alertRecordMapper, EmergencyPlanMapper emergencyPlanMapper) {
        this.alertRuleMapper = alertRuleMapper;
        this.alertRecordMapper = alertRecordMapper;
        this.emergencyPlanMapper = emergencyPlanMapper;
    }

    @Override
    @Transactional
    public AlertRule saveRule(AlertRuleSaveDTO dto, String tenantId) {
        AlertRule rule = BeanCopyUtils.copy(dto, AlertRule.class);
        rule.setTenantId(tenantId);
        if (rule.getId() == null) {
            rule.setRuleCode("RULE" + System.currentTimeMillis());
            rule.setCreateTime(LocalDateTime.now());
            alertRuleMapper.insert(rule);
        } else {
            rule.setUpdateTime(LocalDateTime.now());
            alertRuleMapper.updateById(rule);
        }
        return rule;
    }

    @Override
    @Transactional
    public void deleteRule(Long id) {
        alertRuleMapper.deleteById(id);
    }

    @Override
    public AlertRule getRuleById(Long id) {
        return alertRuleMapper.selectById(id);
    }

    @Override
    public List<AlertRule> listRules(String tenantId) {
        return alertRuleMapper.selectList(null);
    }

    @Override
    @Transactional
    public void enableRule(Long id, boolean enable) {
        AlertRule rule = alertRuleMapper.selectById(id);
        if (rule != null) {
            rule.setIsEnabled(enable ? 1 : 0);
            alertRuleMapper.updateById(rule);
        }
    }

    @Override
    @Transactional
    public AlertRecord triggerAlert(AlertRecord record) {
        record.setAlertCode("ALERT" + System.currentTimeMillis());
        record.setStatus("pending");
        record.setCreateTime(LocalDateTime.now());
        alertRecordMapper.insert(record);

        List<EmergencyPlan> plans = emergencyPlanMapper.selectByAlertLevel(record.getLevel(), record.getTenantId());
        if (!plans.isEmpty()) {
            EmergencyPlan plan = plans.get(0);
            record.setEmergencyPlanId(plan.getId());
            alertRecordMapper.updateById(record);
            executePlan(plan.getId(), record.getId());
        }

        return record;
    }

    @Override
    @Transactional
    public void handleAlert(Long alertId, String handleUser, String handleResult, String remark) {
        AlertRecord record = alertRecordMapper.selectById(alertId);
        if (record != null) {
            record.setStatus("handled");
            record.setHandleTime(LocalDateTime.now());
            record.setHandleUser(handleUser);
            record.setHandleResult(handleResult);
            record.setRemark(remark);
            alertRecordMapper.updateById(record);
        }
    }

    @Override
    public void autoHandleAlerts() {
        List<AlertRecord> pendingAlerts = alertRecordMapper.selectByStatus("pending", "T001");
        for (AlertRecord alert : pendingAlerts) {
            AlertRule rule = alertRuleMapper.selectById(alert.getRuleId());
            if (rule != null && rule.getAutoHandle() != null && rule.getAutoHandle() == 1) {
                handleAlert(alert.getId(), "system", "auto-handled", "自动处理完成");
            }
        }
    }

    @Override
    public PageResult<?> listRecords(AlertRecordQueryDTO dto, String tenantId) {
        Page<AlertRecord> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<AlertRecord> result = alertRecordMapper.pageQuery(page, dto, tenantId);
        return PageResult.of(result.getRecords(), result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public AlertRecord getRecordById(Long id) {
        return alertRecordMapper.selectById(id);
    }

    @Override
    @Transactional
    public EmergencyPlan savePlan(EmergencyPlan plan, String tenantId) {
        plan.setTenantId(tenantId);
        if (plan.getId() == null) {
            plan.setPlanCode("PLAN" + System.currentTimeMillis());
            plan.setCreateTime(LocalDateTime.now());
            plan.setExecuteCount(0);
            emergencyPlanMapper.insert(plan);
        } else {
            plan.setUpdateTime(LocalDateTime.now());
            emergencyPlanMapper.updateById(plan);
        }
        return plan;
    }

    @Override
    @Transactional
    public void deletePlan(Long id) {
        emergencyPlanMapper.deleteById(id);
    }

    @Override
    public EmergencyPlan getPlanById(Long id) {
        return emergencyPlanMapper.selectById(id);
    }

    @Override
    public List<EmergencyPlan> listPlans(String tenantId) {
        return emergencyPlanMapper.selectList(null);
    }

    @Override
    @Transactional
    public void executePlan(Long planId, Long alertId) {
        EmergencyPlan plan = emergencyPlanMapper.selectById(planId);
        if (plan != null) {
            plan.setExecuteCount(plan.getExecuteCount() != null ? plan.getExecuteCount() + 1 : 1);
            plan.setLastExecuteTime(LocalDateTime.now());
            emergencyPlanMapper.updateById(plan);
        }
    }

    @Override
    public Map<String, Object> getAlertStatistics(String tenantId) {
        Map<String, Object> result = new HashMap<>();
        result.put("total", alertRecordMapper.selectCount(null));
        result.put("pending", alertRecordMapper.countByStatus("pending", tenantId));
        result.put("handled", alertRecordMapper.countByStatus("handled", tenantId));
        result.put("critical", alertRecordMapper.countByLevel("critical", tenantId));
        result.put("warning", alertRecordMapper.countByLevel("warning", tenantId));
        result.put("info", alertRecordMapper.countByLevel("info", tenantId));
        return result;
    }
}