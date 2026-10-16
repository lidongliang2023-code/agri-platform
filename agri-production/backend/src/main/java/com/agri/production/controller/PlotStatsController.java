package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.TenantContextService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 地块状态统计（{@code GET /plots/stats}，驾驶舱的"地块分布"）。

 *
 * <p>返回 {@code 状态 → 数量} 的扁平映射（页面就是这么消费的：它按返回的键逐个渲染）。
 * 键用库里真实的状态文案（active/inactive…），**不翻译成页面才认识的中文** —— 编一套映射表
 * 只会让"库里到底有哪些状态"变得看不见。farmId 走 FarmIdResolver 换算。</p>
 */
@RestController
@RequestMapping("/api/v1/production/plots")
public class PlotStatsController {

    private final PlotMapper plotMapper;
    private final FarmIdResolver farmIdResolver;

    public PlotStatsController(PlotMapper plotMapper, FarmIdResolver farmIdResolver) {
        this.plotMapper = plotMapper;
        this.farmIdResolver = farmIdResolver;
    }

    /** 按状态统计地块数（可按农场过滤）。 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam(required = false) String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        Long localFarmId = farmIdResolver.resolveFilter(farmId, tenantId);
        LambdaQueryWrapper<Plot> w = new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId, tenantId);
        if (localFarmId != null) {
            w.eq(Plot::getFarmId, localFarmId);
        }
        List<Plot> plots = plotMapper.selectList(w);
        Map<String, Object> result = new LinkedHashMap<>();
        for (Plot plot : plots) {
            String key = plot.getStatus() == null || plot.getStatus().isBlank()
                    ? "unknown" : plot.getStatus().trim().toLowerCase(Locale.ROOT);
            result.merge(key, 1, (a, b) -> ((Number) a).intValue() + 1);
        }
        result.put("total", plots.size());
        return ApiResponse.success(result);
    }
}
