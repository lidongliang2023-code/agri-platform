package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.ISensorPivotService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.MonitorEnvVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 生产监控看板的数据接口（{@code /api/v1/production/monitor}）。
 *
 * <p><b>这个控制器只做一件事</b>：把看板需要的「环境实时概览」按农场/地块口径算好返回。
 * 聚合逻辑全部复用 {@link ISensorPivotService#monitorEnv}（它和生长曲线、设备读数
 * 读的是同一张 {@code agri_prod_sensor_data} 长表、同一套指标别名），
 * 页面不再自己在前端 reduce 平均值、也不再 {@code slice(-24)} 猜时间窗口。</p>
 *
 * <p><b>为什么设备数据不在这里</b>：设备台账已收敛到物联网系统，设备数量/在线率走
 * {@code GET /api/v1/production/iot/device-stats}、设备明细走 {@code /iot/devices}。
 * 看板如果在这里再算一遍设备数，就又造了一个轮子。</p>
 */
@RestController
@RequestMapping("/api/v1/production/monitor")
public class MonitorController {

    private final ISensorPivotService pivotService;
    private final FarmIdResolver farmIdResolver;

    public MonitorController(ISensorPivotService pivotService, FarmIdResolver farmIdResolver) {
        this.pivotService = pivotService;
        this.farmIdResolver = farmIdResolver;
    }

    /**
     * 环境实时概览（窗口聚合 + 按小时曲线）。
     *
     * @param farmId 农场筛选（接受数字 id / 农场编码 / 平台标识 DEMO-FARM-001），可为空
     * @param plotId 地块筛选，可为空
     * @param hours  窗口长度（小时），默认 24，上限 168（7 天）
     * @return 概览；窗口内没有采样数据时 {@code sampleCount=0} 且各指标缺键
     */
    @GetMapping("/env-summary")
    public ApiResponse<MonitorEnvVO> envSummary(
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String plotId,
            @RequestParam(defaultValue = "24") int hours) {
        String tenantId = TenantContextService.currentTenantId();
        // 页面传的是"当前农场"的平台标识：不换算的话按农场筛选会静默失效（返回全租户数据）
        Long localFarmId = farmIdResolver.resolveFilter(farmId, tenantId);
        return ApiResponse.success(pivotService.monitorEnv(tenantId, localFarmId, plotId, hours));
    }
}
