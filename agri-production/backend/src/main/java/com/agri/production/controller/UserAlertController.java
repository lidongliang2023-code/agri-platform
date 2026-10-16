package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IUserAlertService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.UserAlertVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 用户端：告警中心（{@code /api/v1/production/alerts}）。
 *
 * <p>只实现页面真会调的记录类端点；<b>不碰 {@code /alerts/rules/**}</b> —— 那几条已经由
 * 本服务既有的 {@code AlertController} 提供（契约与页面不同，见 IUserAlertService 的说明），
 * 且切流时会被网关单独留在平台侧。两处都声明 {@code /rules} 会直接导致 Spring 启动时
 * 报"存在重复映射"，所以这里刻意不写。</p>
 *
 * <p>不实现 {@code GET /alerts/{alertId}}：页面没有详情调用，多一个端点就多一处要维护的租户校验，
 * 而且 {@code /alerts/{id}} 这种吃任意段的路径最容易把 {@code /alerts/stats} 之类的字面量接走。</p>
 */
@RestController
@RequestMapping("/api/v1/production/alerts")
public class UserAlertController {

    private final IUserAlertService alertService;

    public UserAlertController(IUserAlertService alertService) {
        this.alertService = alertService;
    }

    /** 告警分页（farmId / alertLevel / alertSource / status / keyword / startDate / endDate 均可选）。 */
    @GetMapping
    public ApiResponse<PageResult<UserAlertVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) Integer alertLevel,
            @RequestParam(required = false) Integer alertSource,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(alertService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                TenantContextService.currentTenantId(), farmId, alertLevel, alertSource, status,
                keyword, startDate, endDate));
    }

    /** 未处理告警列表（看板的"待处理"清单）。 */
    @GetMapping("/unhandled")
    public ApiResponse<List<UserAlertVO>> unhandled(@RequestParam(required = false) String farmId) {
        return ApiResponse.success(alertService.unhandled(TenantContextService.currentTenantId(), farmId));
    }

    /** 告警统计（顶部指标卡：总数 / 未处理 / 处理中 / 已处理 / 已忽略 / 各级别数量）。 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam(required = false) String farmId) {
        return ApiResponse.success(alertService.stats(TenantContextService.currentTenantId(), farmId));
    }

    /** 处置告警（body {status, handleRemark}；status 1~4）。 */
    @PatchMapping("/{alertId}/handle")
    public ApiResponse<UserAlertVO> handle(@PathVariable String alertId,
                                          @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(alertService.handle(
                TenantContextService.currentTenantId(), alertId,
                body == null ? null : intOrNull(body.get("status")),
                body == null ? null : str(body.get("handleRemark"))));
    }

    /** 批量忽略（body {alertIds: [...]}）。 */
    @PatchMapping("/ignore")
    public ApiResponse<Map<String, Object>> ignore(@RequestBody(required = false) Map<String, Object> body) {
        Object raw = body == null ? null : body.get("alertIds");
        List<String> ids = raw instanceof List<?> list
                ? list.stream().map(item -> item == null ? null : String.valueOf(item)).toList()
                : List.of();
        int updated = alertService.ignore(TenantContextService.currentTenantId(), ids);
        return ApiResponse.success(Map.of("updated", updated));
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    /**
     * 状态解析。
     *
     * <p>转不动时返回 null，交给服务层报 400「告警状态应为 1 未处理…」，
     * 而不是让 NumberFormatException 被全局兜底成 500「系统异常」。</p>
     */
    private static Integer intOrNull(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
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
