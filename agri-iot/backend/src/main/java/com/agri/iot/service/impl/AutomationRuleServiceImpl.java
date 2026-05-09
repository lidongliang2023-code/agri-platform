package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.iot.entity.AutomationRule;
import com.agri.iot.mapper.AutomationRuleMapper;
import com.agri.iot.service.IAutomationRuleService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AutomationRuleServiceImpl implements IAutomationRuleService {

    private final AutomationRuleMapper ruleMapper;

    @Override
    public PageResult<AutomationRule> page(String plotId, String ruleType, Integer pageNum, Integer pageSize) {
        Page<AutomationRule> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<AutomationRule> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AutomationRule::getDelFlag, 0);
        if (plotId != null && !plotId.isEmpty()) {
            wrapper.like(AutomationRule::getConditionGroup, plotId);
        }
        if (ruleType != null && !ruleType.isEmpty()) {
            wrapper.eq(AutomationRule::getRuleType, ruleType);
        }
        IPage<AutomationRule> result = ruleMapper.selectPage(page, wrapper);
        return new PageResult<AutomationRule>(result.getRecords(), result.getTotal());
    }

    @Override
    public AutomationRule getById(Long id) {
        AutomationRule rule = ruleMapper.selectById(id);
        if (rule == null || rule.getDelFlag() == 1) {
            throw new BusinessException("规则不存在");
        }
        return rule;
    }

    @Override
    public List<AutomationRule> listByPlotId(String plotId) {
        return ruleMapper.selectByPlotId(plotId);
    }

    @Override
    public List<AutomationRule> listEnabledRules() {
        return ruleMapper.selectByEnabled(1);
    }

    @Override
    @Transactional
    public void save(AutomationRule rule) {
        rule.setEnableStatus(0);
        rule.setTriggerCount(0);
        rule.setDelFlag(0);
        ruleMapper.insert(rule);
    }

    @Override
    @Transactional
    public void update(Long id, AutomationRule rule) {
        AutomationRule existing = getById(id);
        rule.setId(id);
        ruleMapper.updateById(rule);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        AutomationRule rule = getById(id);
        rule.setDelFlag(1);
        ruleMapper.updateById(rule);
    }

    @Override
    @Transactional
    public void enable(Long id) {
        AutomationRule rule = getById(id);
        rule.setEnableStatus(1);
        ruleMapper.updateById(rule);
    }

    @Override
    @Transactional
    public void disable(Long id) {
        AutomationRule rule = getById(id);
        rule.setEnableStatus(0);
        ruleMapper.updateById(rule);
    }

    @Override
    @Transactional
    public void triggerRule(Long id) {
        AutomationRule rule = getById(id);
        rule.setLastTriggerTime(LocalDateTime.now());
        rule.setTriggerCount(rule.getTriggerCount() + 1);
        ruleMapper.updateById(rule);
    }
}