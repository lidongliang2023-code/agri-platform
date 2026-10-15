package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IAdminFoodSafetyService;
import com.agri.production.vo.AdminFsAlertVO;
import com.agri.production.vo.AdminFsCirculationVO;
import com.agri.production.vo.AdminFsFarmRiskVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：食品安全 - 监测与告警（{@code /api/v1/production/admin/food-safety}）。
 *
 * <p>本控制器负责这一域的**第一子域**：告警列表 / 告警处置 / 流通异常分页 / 流通异常处理 /
 * 风险分布 / 监控指标。合规抽查、信任标签、冷链三组端点按子域分批接（表已建好）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/food-safety")
public class AdminFoodSafetyMonitorController {

    private final IAdminFoodSafetyService foodSafetyService;

    public AdminFoodSafetyMonitorController(IAdminFoodSafetyService foodSafetyService) {
        this.foodSafetyService = foodSafetyService;
    }

    /** 食品安全告警列表（页面 P15 事件列表）。 */
    @GetMapping("/alerts")
    public ApiResponse<List<AdminFsAlertVO>> alerts(@RequestParam(required = false) Integer limit) {
        return ApiResponse.success(foodSafetyService.listAlerts(limit == null ? 20 : limit));
    }

    /** 处置食品安全告警（body {measure, remark}）。 */
    @PostMapping("/alerts/{alertId}/handle")
    public ApiResponse<AdminFsAlertVO> handleAlert(@PathVariable String alertId,
                                                  @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(foodSafetyService.handleAlert(alertId,
                body == null ? null : str(body.get("measure")),
                body == null ? null : str(body.get("remark"))));
    }

    /** 流通异常分页（type / severity / date / keyword 均可选）。 */
    @GetMapping("/circulation")
    public ApiResponse<PageResult<AdminFsCirculationVO>> circulation(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(foodSafetyService.pageCirculation(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                type, severity, date, keyword));
    }

    /** 处理流通异常（body {action, remark}）。 */
    @PostMapping("/circulation/{anomalyId}/handle")
    public ApiResponse<AdminFsCirculationVO> handleCirculation(
            @PathVariable String anomalyId,
            @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(foodSafetyService.handleCirculation(anomalyId,
                body == null ? null : str(body.get("action")),
                body == null ? null : str(body.get("remark"))));
    }

    /** 农场风险评分（热力图）。 */
    @GetMapping("/risk-distribution")
    public ApiResponse<List<AdminFsFarmRiskVO>> riskDistribution() {
        return ApiResponse.success(foodSafetyService.riskDistribution());
    }

    /** 监控中心指标。 */
    @GetMapping("/metrics")
    public ApiResponse<Map<String, Object>> metrics() {
        return ApiResponse.success(foodSafetyService.metrics());
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
