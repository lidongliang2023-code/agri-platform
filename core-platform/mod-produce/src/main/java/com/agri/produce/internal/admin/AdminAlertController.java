package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertRuleEntity;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：告警监管（/api/v1/production/admin/alerts）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/alerts")
@RequiredArgsConstructor
public class AdminAlertController {

    private final AdminAlertService adminAlertService;

    /** 告警规则分页 */
    @GetMapping("/rules")
    public ApiResponse<PageResult<AlertRuleEntity>> pageRules(@RequestParam(defaultValue = "1") long page,
                                                              @RequestParam(defaultValue = "10") long size,
                                                              @RequestParam(required = false) String keyword,
                                                              @RequestParam(required = false) String level) {
        return ApiResponse.ok(adminAlertService.pageRules(page, size, keyword, level));
    }

    /** 告警记录分页 */
    @GetMapping
    public ApiResponse<PageResult<AlertInfoEntity>> pageAlerts(@RequestParam(defaultValue = "1") long page,
                                                               @RequestParam(defaultValue = "10") long size,
                                                               @RequestParam(required = false) String status) {
        return ApiResponse.ok(adminAlertService.pageAlerts(page, size, status));
    }

    /** 告警统计 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats() {
        return ApiResponse.ok(adminAlertService.stats());
    }

    /** 告警派单 */
    @PostMapping("/{alertId}/dispatch")
    public ApiResponse<AlertInfoEntity> dispatch(@org.springframework.web.bind.annotation.PathVariable String alertId,
                                                 @RequestParam String memberId,
                                                 @RequestParam(required = false) String remark) {
        return ApiResponse.ok(adminAlertService.dispatch(alertId, memberId, remark));
    }

    /** 启用/停用规则 */
    @PostMapping("/rules/{ruleId}/toggle")
    public ApiResponse<AlertRuleEntity> toggleRule(
            @org.springframework.web.bind.annotation.PathVariable String ruleId,
            @RequestParam(defaultValue = "1") int enabledFlag) {
        return ApiResponse.ok(adminAlertService.toggleRule(ruleId, enabledFlag));
    }

    /** 紧急告警（CRITICAL 且未处置） */
    @GetMapping("/emergency")
    public ApiResponse<List<AlertInfoEntity>> emergency(@RequestParam(defaultValue = "60") int minutes) {
        return ApiResponse.ok(adminAlertService.emergency(minutes));
    }

    /** 告警复核（已处置待复核） */
    @GetMapping("/review")
    public ApiResponse<PageResult<AlertInfoEntity>> review(@RequestParam(defaultValue = "1") long page,
                                                           @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(adminAlertService.review(page, size));
    }
}
