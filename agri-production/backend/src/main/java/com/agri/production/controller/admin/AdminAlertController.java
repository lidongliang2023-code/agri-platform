package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IAdminAlertService;
import com.agri.production.vo.AdminAlertReviewVO;
import com.agri.production.vo.AdminEmergencyPlanVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 运营端：异常告警的「关闭 / 应急预案 / 灾害复盘」（{@code /api/v1/production/admin/alerts}）。
 *
 * <p>只实现前端页面真的在调、且**两边都没有实现**的那几条：告警列表 / 规则 / 派单 / 统计仍在平台侧
 * （网关注释里说明过运营端按域逐块切）。</p>
 *
 * <p>路径按契约 {@code api/admin/alerts.ts}：{@code PATCH /{id}/close}、
 * {@code GET|POST /emergency}、{@code PUT /emergency/{id}}、{@code GET|POST /review}、{@code PUT /review/{id}}。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/alerts")
public class AdminAlertController {

    private final IAdminAlertService adminAlertService;

    public AdminAlertController(IAdminAlertService adminAlertService) {
        this.adminAlertService = adminAlertService;
    }

    /**
     * 告警列表分页（运营端「告警中心」页面走这条）。
     *
     * <p>取代了 {@code ProductionAdminController} 里那个 {@code GET /admin/alerts}：
     * 它返回的是**裸数组 + 只查 status='pending'**，而页面按 {@code PageResult<Alert>} 消费
     * （读 {@code data.records}）—— 形状不对，页面上一条也渲染不出来。这里按页面契约出参。</p>
     */
    @GetMapping
    public ApiResponse<PageResult<AdminAlertReviewVO>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Integer alertLevel) {
        return ApiResponse.success(adminAlertService.pageAlerts(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), status, alertLevel));
    }

    /** 关闭告警（告警中心 / 运营看板 / 监控中心三处都在调）。 */
    @PatchMapping("/{alertId}/close")
    public ApiResponse<Map<String, Object>> close(@PathVariable Long alertId,
                                                 @RequestBody(required = false) Map<String, Object> body,
                                                 @RequestParam(required = false) String operator) {
        String remark = body == null || body.get("remark") == null ? null : String.valueOf(body.get("remark"));
        return ApiResponse.success(adminAlertService.closeAlert(alertId, operator, remark));
    }

    /** 应急预案分页（页面 EmergencyPlan 走这条）。 */
    @GetMapping("/emergency")
    public ApiResponse<PageResult<AdminEmergencyPlanVO>> plans(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String alertType,
            @RequestParam(required = false) Integer status) {
        return ApiResponse.success(adminAlertService.pagePlans(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), alertType, status));
    }

    /** 新建应急预案。 */
    @PostMapping("/emergency")
    public ApiResponse<AdminEmergencyPlanVO> createPlan(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminAlertService.createPlan(payload));
    }

    /** 更新应急预案。 */
    @PutMapping("/emergency/{planId}")
    public ApiResponse<AdminEmergencyPlanVO> updatePlan(@PathVariable Long planId,
                                                       @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminAlertService.updatePlan(planId, payload));
    }

    /** 灾害复盘分页（页面 DisasterReview 走这条；行是"已处置告警"，页面自己映射成复盘视图）。 */
    @GetMapping("/review")
    public ApiResponse<PageResult<AdminAlertReviewVO>> reviews(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String disasterType) {
        return ApiResponse.success(adminAlertService.pageReviews(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), disasterType));
    }

    /** 新建灾害复盘：本部署明确不支持（原因见 IAdminAlertService#createReview）。 */
    @PostMapping("/review")
    public ApiResponse<AdminAlertReviewVO> createReview(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminAlertService.createReview(payload));
    }

    /** 保存复盘信息（页面传 handleProcess，落到该告警的处置结果）。 */
    @PutMapping("/review/{alertId}")
    public ApiResponse<AdminAlertReviewVO> updateReview(@PathVariable Long alertId,
                                                       @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminAlertService.updateReview(alertId, payload));
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
