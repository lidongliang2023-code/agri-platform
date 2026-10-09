package com.agri.produce.internal.alert;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 告警规则与告警记录（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertRuleService alertRuleService;
    private final AlertInfoService alertInfoService;

    @GetMapping("/rules")
    public ApiResponse<PageResult<AlertRuleEntity>> pageAlertRule(@RequestParam(defaultValue = "1") long page,
                                                                  @RequestParam(defaultValue = "10") long size,
                                                                  @RequestParam(required = false) String keyword,
                                                                  @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(alertRuleService.page(page, size, keyword, status));
    }

    @GetMapping("/rules/{id}")
    public ApiResponse<AlertRuleEntity> detailAlertRule(@PathVariable String id) {
        return ApiResponse.ok(alertRuleService.detail(id));
    }

    @PostMapping("/rules")
    public ApiResponse<String> createAlertRule(@RequestBody AlertRuleEntity entity) {
        return ApiResponse.ok(alertRuleService.create(entity).getRuleId());
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<AlertRuleEntity> updateAlertRule(@PathVariable String id, @RequestBody AlertRuleEntity entity) {
        return ApiResponse.ok(alertRuleService.update(id, entity));
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteAlertRule(@PathVariable String id) {
        alertRuleService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping
    public ApiResponse<PageResult<AlertInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                         @RequestParam(defaultValue = "10") long size,
                                                         @RequestParam(required = false) String keyword,
                                                         @RequestParam(required = false) String status) {
        return ApiResponse.ok(alertInfoService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<AlertInfoEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(alertInfoService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody AlertInfoEntity entity) {
        return ApiResponse.ok(alertInfoService.create(entity).getAlertId());
    }

    @PutMapping("/{id}")
    public ApiResponse<AlertInfoEntity> update(@PathVariable String id, @RequestBody AlertInfoEntity entity) {
        return ApiResponse.ok(alertInfoService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        alertInfoService.delete(id);
        return ApiResponse.ok();
    }

    /** 启用/停用规则 */
    @PostMapping("/rules/{ruleId}/toggle")
    public ApiResponse<AlertRuleEntity> toggle(@PathVariable String ruleId,
                                               @RequestParam(defaultValue = "1") int enabledFlag) {
        return ApiResponse.ok(alertRuleService.toggle(ruleId, enabledFlag));
    }

    /** 未处置告警 */
    @GetMapping("/unhandled")
    public ApiResponse<List<AlertInfoEntity>> unhandled() {
        return ApiResponse.ok(alertInfoService.listUnhandled());
    }

    /** 告警处置 */
    @PostMapping("/{alertId}/handle")
    public ApiResponse<AlertInfoEntity> handle(@PathVariable String alertId,
                                               @RequestParam(required = false) String handleBy,
                                               @RequestParam(required = false) String remark,
                                               @RequestParam(defaultValue = "false") boolean ignore) {
        return ApiResponse.ok(alertInfoService.handle(alertId, handleBy, remark, ignore));
    }

    /** 告警统计 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats() {
        return ApiResponse.ok(alertInfoService.stats());
    }
}
