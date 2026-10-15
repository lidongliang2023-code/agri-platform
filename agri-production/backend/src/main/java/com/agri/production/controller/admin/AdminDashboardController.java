package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IAdminDashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：运营仪表盘（{@code /api/v1/production/admin/dashboard}）。
 *
 * <p>按页面契约 {@code api/admin/dashboard.ts} 里**页面真的会调**的六条实现：
 * 汇总指标 / 多维度明细 / 种植面积排行 / 区域分布 / 告警级别分布 / 近 7 天趋势。
 * 对应页面是 {@code admin/dashboard/{OpsDashboard,OpsProductionOverview,OpsDataScreen}}。</p>
 *
 * <p>聚合口径写在 {@link IAdminDashboardService} 的实现类注释里 —— 仪表盘最容易悄悄编数，
 * 所以每条指标的数据来源与近似都必须可查。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/dashboard")
public class AdminDashboardController {

    private final IAdminDashboardService adminDashboardService;

    public AdminDashboardController(IAdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    /** 汇总指标（生产总览页的指标卡）。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(adminDashboardService.overview(startDate, endDate));
    }

    /** 多维度明细（生产总览页的表格）。 */
    @GetMapping("/overview-rows")
    public ApiResponse<List<Map<String, Object>>> overviewRows(
            @RequestParam(required = false, defaultValue = "region") String dimension,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String region) {
        return ApiResponse.success(adminDashboardService.overviewRows(dimension, startDate, endDate, region));
    }

    /** 种植面积排行（TOP N 农场）。 */
    @GetMapping("/rank")
    public ApiResponse<List<Map<String, Object>>> rank(
            @RequestParam(required = false, defaultValue = "10") Integer limit) {
        return ApiResponse.success(adminDashboardService.rank(limit == null ? 10 : limit));
    }

    /** 区域分布。 */
    @GetMapping("/region-distribution")
    public ApiResponse<List<Map<String, Object>>> regionDistribution(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(adminDashboardService.regionDistribution(startDate, endDate));
    }

    /** 告警级别分布。 */
    @GetMapping("/alert-trend")
    public ApiResponse<Map<String, Object>> alertTrend() {
        return ApiResponse.success(adminDashboardService.alertTrend());
    }

    /** 近 7 天趋势（默认最近 7 天）。 */
    @GetMapping("/trend")
    public ApiResponse<List<Map<String, Object>>> trend(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(adminDashboardService.trend(startDate, endDate));
    }
}
