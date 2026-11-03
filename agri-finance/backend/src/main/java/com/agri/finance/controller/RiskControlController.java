package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.RiskControlRule;
import com.agri.finance.service.RiskCenterService;
import com.agri.finance.service.impl.RiskControlRuleServiceImpl;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/risk-control")
@OperatorOnly("finance:fund")
public class RiskControlController {

    private final RiskControlRuleServiceImpl riskControlRuleService;
    private final RiskCenterService riskCenterService;

    public RiskControlController(
            RiskControlRuleServiceImpl riskControlRuleService,
            RiskCenterService riskCenterService) {
        this.riskControlRuleService = riskControlRuleService;
        this.riskCenterService = riskCenterService;
    }

    @GetMapping("/center")
    public Map<String, Object> center(@RequestParam(defaultValue = "2001") String subjectId) {
        return Map.of("code", 200, "message", "success", "data", riskCenterService.center(subjectId));
    }

    @PostMapping("/center/assess/{subjectId}")
    public Map<String, Object> assess(@PathVariable String subjectId) {
        return Map.of("code", 200, "message", "风险快照已生成",
                "data", riskCenterService.assess(subjectId, "finance-fund"));
    }

    @GetMapping("/center/snapshots")
    public Map<String, Object> snapshots(@RequestParam(defaultValue = "") String subjectId) {
        return Map.of("code", 200, "message", "success",
                "data", riskCenterService.snapshots(subjectId));
    }

    @PostMapping("/rule")
    public Map<String, Object> createRule(@RequestBody RiskControlRule rule) {
        RiskControlRule result = riskControlRuleService.createRule(rule);
        return Map.of("code", 200, "message", "创建成功", "data", result);
    }

    @PutMapping("/rule")
    public Map<String, Object> updateRule(@RequestBody RiskControlRule rule) {
        RiskControlRule result = riskControlRuleService.updateRule(rule);
        return Map.of("code", 200, "message", "更新成功", "data", result);
    }

    @PostMapping("/rule/enable/{ruleId}")
    public Map<String, Object> enableRule(@PathVariable String ruleId) {
        riskControlRuleService.enableRule(ruleId);
        return Map.of("code", 200, "message", "已启用");
    }

    @PostMapping("/rule/disable/{ruleId}")
    public Map<String, Object> disableRule(@PathVariable String ruleId) {
        riskControlRuleService.disableRule(ruleId);
        return Map.of("code", 200, "message", "已禁用");
    }

    @GetMapping("/rules/enabled")
    public Map<String, Object> getEnabledRules() {
        List<RiskControlRule> rules = riskControlRuleService.getEnabledRules();
        return Map.of("code", 200, "message", "success", "data", rules);
    }

    @GetMapping("/rules/type/{ruleType}")
    public Map<String, Object> getRulesByType(@PathVariable String ruleType) {
        List<RiskControlRule> rules = riskControlRuleService.getRulesByType(ruleType);
        return Map.of("code", 200, "message", "success", "data", rules);
    }

    @GetMapping("/rules")
    public Map<String, Object> getAllRules() {
        List<RiskControlRule> rules = riskControlRuleService.list();
        return Map.of("code", 200, "message", "success", "data", rules);
    }
}
