package com.agri.production.controller;

import com.agri.production.dto.AlertRecordQueryDTO;
import com.agri.production.dto.AlertRuleSaveDTO;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.AlertRule;
import com.agri.production.entity.EmergencyPlan;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IAlertService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import com.agri.production.common.entity.PageResult;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/alerts")
public class AlertController {

    private final IAlertService alertService;

    public AlertController(IAlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/rules")
    public ApiResponse<List<AlertRule>> listRules() {
        List<AlertRule> rules = alertService.listRules("T001");
        return ApiResponse.success(rules);
    }

    @GetMapping("/rules/{id}")
    public ApiResponse<AlertRule> getRule(@PathVariable Long id) {
        AlertRule rule = alertService.getRuleById(id);
        return ApiResponse.success(rule);
    }

    @PostMapping("/rules")
    public ApiResponse<AlertRule> saveRule(@Valid @RequestBody AlertRuleSaveDTO dto) {
        AlertRule rule = alertService.saveRule(dto, "T001");
        return ApiResponse.success(rule);
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<AlertRule> updateRule(@PathVariable Long id, @Valid @RequestBody AlertRuleSaveDTO dto) {
        dto.setId(id);
        AlertRule rule = alertService.saveRule(dto, "T001");
        return ApiResponse.success(rule);
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable Long id) {
        alertService.deleteRule(id);
        return ApiResponse.success();
    }

    @PostMapping("/rules/{id}/enable")
    public ApiResponse<Void> enableRule(@PathVariable Long id, @RequestParam boolean enable) {
        alertService.enableRule(id, enable);
        return ApiResponse.success();
    }

    @GetMapping("/records")
    public ApiResponse<PageResult<?>> listRecords(AlertRecordQueryDTO dto) {
        return ApiResponse.success(alertService.listRecords(dto, "T001"));
    }

    @GetMapping("/records/{id}")
    public ApiResponse<AlertRecord> getRecord(@PathVariable Long id) {
        AlertRecord record = alertService.getRecordById(id);
        return ApiResponse.success(record);
    }

    @PostMapping("/records/{id}/handle")
    public ApiResponse<Void> handleAlert(
            @PathVariable Long id,
            @RequestParam String handleUser,
            @RequestParam String handleResult,
            @RequestParam(required = false) String remark) {
        alertService.handleAlert(id, handleUser, handleResult, remark);
        return ApiResponse.success();
    }

    @GetMapping("/plans")
    public ApiResponse<List<EmergencyPlan>> listPlans() {
        List<EmergencyPlan> plans = alertService.listPlans("T001");
        return ApiResponse.success(plans);
    }

    @GetMapping("/plans/{id}")
    public ApiResponse<EmergencyPlan> getPlan(@PathVariable Long id) {
        EmergencyPlan plan = alertService.getPlanById(id);
        return ApiResponse.success(plan);
    }

    @PostMapping("/plans")
    public ApiResponse<EmergencyPlan> savePlan(@RequestBody EmergencyPlan plan) {
        EmergencyPlan saved = alertService.savePlan(plan, "T001");
        return ApiResponse.success(saved);
    }

    @PutMapping("/plans/{id}")
    public ApiResponse<EmergencyPlan> updatePlan(@PathVariable Long id, @RequestBody EmergencyPlan plan) {
        plan.setId(id);
        EmergencyPlan saved = alertService.savePlan(plan, "T001");
        return ApiResponse.success(saved);
    }

    @DeleteMapping("/plans/{id}")
    public ApiResponse<Void> deletePlan(@PathVariable Long id) {
        alertService.deletePlan(id);
        return ApiResponse.success();
    }

    @PostMapping("/plans/{id}/execute")
    public ApiResponse<Void> executePlan(@PathVariable Long id, @RequestParam Long alertId) {
        alertService.executePlan(id, alertId);
        return ApiResponse.success();
    }

    @GetMapping("/statistics")
    public ApiResponse<Map<String, Object>> getStatistics() {
        Map<String, Object> statistics = alertService.getAlertStatistics("T001");
        return ApiResponse.success(statistics);
    }
}