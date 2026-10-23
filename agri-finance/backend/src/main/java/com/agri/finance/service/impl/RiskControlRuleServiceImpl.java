package com.agri.finance.service.impl;

import com.agri.finance.entity.RiskControlRule;
import com.agri.finance.mapper.RiskControlRuleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class RiskControlRuleServiceImpl extends ServiceImpl<RiskControlRuleMapper, RiskControlRule> {

    public RiskControlRule createRule(RiskControlRule rule) {
        rule.setRuleNo("RCR" + System.currentTimeMillis());
        rule.setStatus("启用");
        rule.setCreatedAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        rule.setDelFlag(0);
        save(rule);
        return rule;
    }

    public RiskControlRule updateRule(RiskControlRule rule) {
        rule.setUpdatedAt(LocalDateTime.now());
        updateById(rule);
        return rule;
    }

    public void enableRule(String ruleId) {
        RiskControlRule rule = getById(ruleId);
        if (rule != null) {
            rule.setStatus("启用");
            rule.setUpdatedAt(LocalDateTime.now());
            updateById(rule);
        }
    }

    public void disableRule(String ruleId) {
        RiskControlRule rule = getById(ruleId);
        if (rule != null) {
            rule.setStatus("禁用");
            rule.setUpdatedAt(LocalDateTime.now());
            updateById(rule);
        }
    }

    public List<RiskControlRule> getEnabledRules() {
        LambdaQueryWrapper<RiskControlRule> query = new LambdaQueryWrapper<>();
        query.eq(RiskControlRule::getStatus, "启用")
             .eq(RiskControlRule::getDelFlag, 0);
        return list(query);
    }

    public List<RiskControlRule> getRulesByType(String ruleType) {
        LambdaQueryWrapper<RiskControlRule> query = new LambdaQueryWrapper<>();
        query.eq(RiskControlRule::getRuleType, ruleType)
             .eq(RiskControlRule::getDelFlag, 0);
        return list(query);
    }
}