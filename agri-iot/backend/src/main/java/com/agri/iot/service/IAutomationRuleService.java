package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.entity.AutomationRule;

import java.util.List;

public interface IAutomationRuleService {

    PageResult<AutomationRule> page(String plotId, String ruleType, Integer pageNum, Integer pageSize);

    AutomationRule getById(Long id);

    List<AutomationRule> listByPlotId(String plotId);

    List<AutomationRule> listEnabledRules();

    void save(AutomationRule rule);

    void update(Long id, AutomationRule rule);

    void delete(Long id);

    void enable(Long id);

    void disable(Long id);

    void triggerRule(Long id);
}