package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.entity.AutomationRule;
import com.agri.iot.service.IAutomationRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/automation-rule")
@RequiredArgsConstructor
public class AutomationRuleController {

    private final IAutomationRuleService automationRuleService;

    @GetMapping("/page")
    public ApiResponse<PageResult<AutomationRule>> page(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String ruleType,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        return ApiResponse.success(automationRuleService.page(plotId, ruleType, pageNum, pageSize));
    }

    @GetMapping("/{id}")
    public ApiResponse<AutomationRule> getDetail(@PathVariable Long id) {
        return ApiResponse.success(automationRuleService.getById(id));
    }

    @GetMapping("/plot/{plotId}")
    public ApiResponse<List<AutomationRule>> listByPlotId(@PathVariable String plotId) {
        return ApiResponse.success(automationRuleService.listByPlotId(plotId));
    }

    @GetMapping("/enabled")
    public ApiResponse<List<AutomationRule>> listEnabled() {
        return ApiResponse.success(automationRuleService.listEnabledRules());
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody AutomationRule rule) {
        automationRuleService.save(rule);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody AutomationRule rule) {
        automationRuleService.update(id, rule);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        automationRuleService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/enable")
    public ApiResponse<Void> enable(@PathVariable Long id) {
        automationRuleService.enable(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/disable")
    public ApiResponse<Void> disable(@PathVariable Long id) {
        automationRuleService.disable(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/trigger")
    public ApiResponse<Void> trigger(@PathVariable Long id) {
        automationRuleService.triggerRule(id);
        return ApiResponse.success();
    }
}