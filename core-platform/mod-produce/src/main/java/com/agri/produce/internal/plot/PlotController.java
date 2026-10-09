package com.agri.produce.internal.plot;

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
 * 地块/棚管理（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/plots")
@RequiredArgsConstructor
public class PlotController {

    private final PlotInfoService plotInfoService;
    private final PlotSoilService plotSoilService;

    @GetMapping
    public ApiResponse<PageResult<PlotInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(plotInfoService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<PlotInfoEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(plotInfoService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody PlotInfoEntity entity) {
        return ApiResponse.ok(plotInfoService.create(entity).getPlotId());
    }

    @PutMapping("/{id}")
    public ApiResponse<PlotInfoEntity> update(@PathVariable String id, @RequestBody PlotInfoEntity entity) {
        return ApiResponse.ok(plotInfoService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        plotInfoService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{plotId}/soil")
    public ApiResponse<PageResult<PlotSoilEntity>> pagePlotSoil(@RequestParam(defaultValue = "1") long page,
                                                                @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(plotSoilService.page(page, size));
    }

    @GetMapping("/{plotId}/soil/{id}")
    public ApiResponse<PlotSoilEntity> detailPlotSoil(@PathVariable String id) {
        return ApiResponse.ok(plotSoilService.detail(id));
    }

    @PostMapping("/{plotId}/soil")
    public ApiResponse<String> createPlotSoil(@RequestBody PlotSoilEntity entity) {
        return ApiResponse.ok(plotSoilService.create(entity).getSoilId());
    }

    @PutMapping("/{plotId}/soil/{id}")
    public ApiResponse<PlotSoilEntity> updatePlotSoil(@PathVariable String id, @RequestBody PlotSoilEntity entity) {
        return ApiResponse.ok(plotSoilService.update(id, entity));
    }

    @DeleteMapping("/{plotId}/soil/{id}")
    public ApiResponse<Void> deletePlotSoil(@PathVariable String id) {
        plotSoilService.delete(id);
        return ApiResponse.ok();
    }

    /** 绑定种养计划 */
    @PostMapping("/{plotId}/bind-plan")
    public ApiResponse<PlotInfoEntity> bindPlan(@PathVariable String plotId,
                                                @RequestParam String planId) {
        return ApiResponse.ok(plotInfoService.bindPlan(plotId, planId));
    }

    /** 解除种养计划（转休耕） */
    @PostMapping("/{plotId}/unbind-plan")
    public ApiResponse<PlotInfoEntity> unbindPlan(@PathVariable String plotId) {
        return ApiResponse.ok(plotInfoService.unbindPlan(plotId));
    }

    /** 地块统计 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam(required = false) String farmId) {
        return ApiResponse.ok(plotInfoService.stats(farmId));
    }

    /** 最新土壤检测 */
    @GetMapping("/{plotId}/soil/latest")
    public ApiResponse<PlotSoilEntity> latestSoil(@PathVariable String plotId) {
        return ApiResponse.ok(plotSoilService.latest(plotId));
    }

    /** 地块土壤检测列表（/soil 的列表语义别名） */
    @GetMapping("/{plotId}/soil-tests")
    public ApiResponse<List<PlotSoilEntity>> soilTests(@PathVariable String plotId) {
        return ApiResponse.ok(plotSoilService.listByPlot(plotId));
    }
}
