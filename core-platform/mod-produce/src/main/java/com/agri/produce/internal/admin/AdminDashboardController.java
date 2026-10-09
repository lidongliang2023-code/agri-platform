package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：数据看板（/api/v1/production/admin/dashboard）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    /** 看板总览 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(adminDashboardService.overview());
    }

    /** 农场面积/地块数排行 */
    @GetMapping("/rank")
    public ApiResponse<List<Map<String, Object>>> rank(@RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.ok(adminDashboardService.rank(limit));
    }

    /** 告警级别分布 */
    @GetMapping("/alert-trend")
    public ApiResponse<Map<String, Object>> alertTrend() {
        return ApiResponse.ok(adminDashboardService.alertTrend());
    }

    /** 看板根路径（等价于 /overview） */
    @GetMapping
    public ApiResponse<Map<String, Object>> index() {
        return ApiResponse.ok(adminDashboardService.overview());
    }
}
