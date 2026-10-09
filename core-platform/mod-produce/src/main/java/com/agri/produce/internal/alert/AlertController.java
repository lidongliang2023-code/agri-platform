package com.agri.produce.internal.alert;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 告警规则与告警记录（用户端）。
 *
 * <p><b>契约口径（V8）。</b>所有对外枚举统一为数字编码，实体与库内仍为英文枚举，
 * 转换收敛在 {@link AlertDict}、输出收敛在 {@link AlertVO}。此前直接吐实体导致
 * 前端 {@code status === 1} 判定全面失效，列表能渲染但筛选、处置、统计全是假的。
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

    /**
     * 启停告警规则（前端 {@code updateAlertRuleStatus} 走 PATCH .../status）。
     */
    @PatchMapping("/rules/{ruleId}/status")
    public ApiResponse<Boolean> updateAlertRuleStatus(@PathVariable String ruleId,
                                                      @RequestBody AlertRuleStatusRequest request) {
        return ApiResponse.ok(alertRuleService.updateStatus(ruleId, request.getStatus()));
    }

    /**
     * 告警列表。
     *
     * <p>{@code farmId / alertLevel / alertSource / status / startDate / endDate} 六个筛选
     * 条件全部真实生效。此前方法签名只收 {@code keyword + status}，前端传的农场、级别、
     * 来源、时间范围被静默丢弃，筛了等于没筛。
     */
    @GetMapping
    public ApiResponse<PageResult<AlertVO>> page(@RequestParam(defaultValue = "1") long page,
                                                 @RequestParam(defaultValue = "10") long size,
                                                 @RequestParam(required = false) String farmId,
                                                 @RequestParam(required = false) String keyword,
                                                 @RequestParam(required = false) Integer alertLevel,
                                                 @RequestParam(required = false) Integer alertSource,
                                                 @RequestParam(required = false) Integer status,
                                                 @RequestParam(required = false) String startDate,
                                                 @RequestParam(required = false) String endDate) {
        return ApiResponse.ok(alertInfoService.page(page, size, farmId, keyword,
                alertLevel, alertSource, status, startDate, endDate));
    }

    @GetMapping("/{id}")
    public ApiResponse<AlertVO> detail(@PathVariable String id) {
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

    /** 启用/停用规则（历史端点，保留兼容；新调用请走 PATCH /rules/{ruleId}/status） */
    @PostMapping("/rules/{ruleId}/toggle")
    public ApiResponse<AlertRuleEntity> toggle(@PathVariable String ruleId,
                                               @RequestParam(defaultValue = "1") int enabledFlag) {
        return ApiResponse.ok(alertRuleService.toggle(ruleId, enabledFlag));
    }

    /** 未处置告警 */
    @GetMapping("/unhandled")
    public ApiResponse<List<AlertVO>> unhandled() {
        return ApiResponse.ok(alertInfoService.listUnhandled());
    }

    /**
     * 告警处置。
     *
     * <p>契约对齐前端 {@code src/api/alerts.ts handleAlert}：
     * {@code PATCH /alerts/{alertId}/handle} + body {@code {status, handleRemark}}。
     * 此前后端是 {@code POST ...?handleBy=&remark=&ignore=}，方法、传参、字段名、
     * 返回类型四处全错，前端必然失败后被空 catch 吞掉走本地补丁——页面上的「已处理」
     * 刷新即消失，是假功能。
     */
    @PatchMapping("/{alertId}/handle")
    public ApiResponse<Boolean> handle(@PathVariable String alertId,
                                       @RequestBody(required = false) HandleAlertRequest request) {
        HandleAlertRequest body = request == null ? new HandleAlertRequest() : request;
        if (body.getStatus() == null) {
            body.setStatus(3);
        }
        return ApiResponse.ok(alertInfoService.handle(alertId, body.getStatus(),
                body.getHandleRemark(), body.getHandlerName()));
    }

    /**
     * 批量忽略告警（前端「批量忽略」按钮）。
     */
    @PatchMapping("/ignore")
    public ApiResponse<Boolean> ignore(@RequestBody(required = false) IgnoreAlertsRequest request) {
        List<String> ids = request == null ? null : request.getAlertIds();
        return ApiResponse.ok(alertInfoService.ignoreBatch(ids));
    }

    /**
     * 告警统计（告警中心顶部指标卡）。
     *
     * <p>返回 {@link AlertStatsVO}，与前端 {@code AlertStats} 字段一一对应。
     */
    @GetMapping("/stats")
    public ApiResponse<AlertStatsVO> stats(@RequestParam(required = false) String farmId) {
        return ApiResponse.ok(alertInfoService.stats(farmId));
    }
}
