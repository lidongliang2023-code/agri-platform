package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
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
     * 生产总览维度统计行（按农场所属省份聚合）。
     *
     * <p>此前 OpsProductionOverview.tsx 的统计行走页面内 FALLBACK_ROWS 示例值。
     * 用 prod_farm_info.province 聚合——库里没有 region 列，但省份是真实且有值的维度。</p>
     */
    @GetMapping("/overview-rows")
    public ApiResponse<List<Map<String, Object>>> overviewRows() {
        return ApiResponse.ok(adminDashboardService.overviewRows());
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
