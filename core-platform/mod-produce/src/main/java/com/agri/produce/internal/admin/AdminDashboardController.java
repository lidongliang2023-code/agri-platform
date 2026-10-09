package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
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

    /**
     * 近 N 天生产趋势（任务完成率 / 作业人数 / 告警数）。
     *
     * <p>此前前端 OpsDashboard.tsx 的近 7 天折线图走的是页面内 FALLBACK_TREND 常量——
     * 一组写死的示例值，与真实数据无关。这里补真实聚合端点。</p>
     */
    @GetMapping("/trend")
    public ApiResponse<List<Map<String, Object>>> trend(@RequestParam(defaultValue = "7") int days) {
        return ApiResponse.ok(adminDashboardService.trend(days));
    }

    /**
     * 生产总览维度统计行。
     *
     * <p>此前 OpsProductionOverview.tsx 的统计行走页面内 FALLBACK_ROWS 示例值；
     * 且本端点原不收任何参数、恒按省份聚合，把前端传来的 dimension / region /
     * startDate / endDate 静默丢弃——用户选「按作物」「按租户」拿到的却还是省份行，
     * 真实数据被贴上错误维度标签。现在四个入参全部真实生效。</p>
     *
     * <p>维度 region→农场省份、crop→地块作物、tenant→农场租户，三者均有真实数据源；
     * 传入不支持的维度会明确 400，绝不退回默认维度假装成功。</p>
     */
    @GetMapping("/overview-rows")
    public ApiResponse<List<Map<String, Object>>> overviewRows(
            @RequestParam(defaultValue = "region") String dimension,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ApiResponse.ok(adminDashboardService.overviewRows(dimension, region, startDate, endDate));
    }

    /**
     * 大屏实时滚动指标（告警 + 采收入库 + 任务完成，按时间倒序）。
     *
     * <p>此前 OpsDataScreen.tsx 的滚动条走页面内 FALLBACK_REALTIME 示例值。</p>
     */
    @GetMapping("/realtime")
    public ApiResponse<List<Map<String, Object>>> realtime(@RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(adminDashboardService.realtime(limit));
    }

    /**
     * 生长趋势分页（数据源 prod_growth_record）。
     *
     * <p>注意：该端点目前无前端消费方（全仓 grep fetchGrowthTrendPage 仅命中 api 层定义），
     * 补它只是为了把已有的真实生长记录暴露出来，避免将来有人再去编一组趋势数据。</p>
     */
    @GetMapping("/growth-trend")
    public ApiResponse<PageResult<Map<String, Object>>> growthTrend(@RequestParam(defaultValue = "1") long page,
                                                                    @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(adminDashboardService.growthTrend(page, size));
    }
}
