package com.agri.production.service;

import com.agri.production.dto.AlertRecordQueryDTO;
import com.agri.production.dto.AlertRuleSaveDTO;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.AlertRule;
import com.agri.production.entity.EmergencyPlan;
import com.agri.production.common.entity.PageResult;

import java.util.List;
import java.util.Map;

public interface IAlertService {

    AlertRule saveRule(AlertRuleSaveDTO dto, String tenantId);

    void deleteRule(Long id);

    AlertRule getRuleById(Long id);

    List<AlertRule> listRules(String tenantId);

    void enableRule(Long id, boolean enable);

    AlertRecord triggerAlert(AlertRecord record);

    void handleAlert(Long alertId, String handleUser, String handleResult, String remark);

    void autoHandleAlerts();

    PageResult<?> listRecords(AlertRecordQueryDTO dto, String tenantId);

    AlertRecord getRecordById(Long id);

    EmergencyPlan savePlan(EmergencyPlan plan, String tenantId);

    void deletePlan(Long id);

    EmergencyPlan getPlanById(Long id);

    List<EmergencyPlan> listPlans(String tenantId);

    void executePlan(Long planId, Long alertId);

    Map<String, Object> getAlertStatistics(String tenantId);
}