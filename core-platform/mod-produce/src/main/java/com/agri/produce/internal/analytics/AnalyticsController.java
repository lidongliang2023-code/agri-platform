package com.agri.produce.internal.analytics;

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
 * 生产数据分析（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsSnapshotService analyticsSnapshotService;

    @GetMapping
    public ApiResponse<PageResult<AnalyticsSnapshotEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                                 @RequestParam(defaultValue = "10") long size,
                                                                 @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(analyticsSnapshotService.page(page, size, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<AnalyticsSnapshotEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(analyticsSnapshotService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody AnalyticsSnapshotEntity entity) {
        return ApiResponse.ok(analyticsSnapshotService.create(entity).getSnapshotId());
    }

    @PutMapping("/{id}")
    public ApiResponse<AnalyticsSnapshotEntity> update(@PathVariable String id, @RequestBody AnalyticsSnapshotEntity entity) {
        return ApiResponse.ok(analyticsSnapshotService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        analyticsSnapshotService.delete(id);
        return ApiResponse.ok();
    }

    /** 指标趋势 */
    @GetMapping("/trend")
    public ApiResponse<List<AnalyticsSnapshotEntity>> trend(@RequestParam String metricCode) {
        return ApiResponse.ok(analyticsSnapshotService.trend(metricCode, null, null));
    }

    /** 分析概览 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(@RequestParam(required = false) String farmId) {
        return ApiResponse.ok(analyticsSnapshotService.overview(farmId));
    }

    /** 分析看板 */
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> dashboard(@RequestParam(required = false) String farmId) {
        return ApiResponse.ok(analyticsSnapshotService.overview(farmId));
    }

    /** 分析报表（按指标分组） */
    @GetMapping("/reports")
    public ApiResponse<List<Map<String, Object>>> reports(@RequestParam(required = false) String metricCode) {
        return ApiResponse.ok(analyticsSnapshotService.reports(metricCode));
    }
}
