package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.ProdPlot;
import com.agri.production.service.IProdPlotService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/production/plot")
@RequiredArgsConstructor
public class ProdPlotController {

    private final IProdPlotService prodPlotService;

    @GetMapping("/page")
    public ApiResponse<IPage<ProdPlot>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String plotName,
            @RequestParam(required = false) String plotType,
            @RequestParam(required = false) String status) {
        Page<ProdPlot> page = new Page<>(pageNum, pageSize);
        IPage<ProdPlot> result = prodPlotService.queryPage(page, farmId, plotName, plotType, status);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<ProdPlot>> getList(
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String plotType) {
        List<ProdPlot> plots;
        if (farmId != null) {
            plots = prodPlotService.getPlotsByFarmId(farmId);
        } else if (status != null && !status.isEmpty()) {
            plots = prodPlotService.getPlotsByStatus(status);
        } else if (plotType != null && !plotType.isEmpty()) {
            plots = prodPlotService.getPlotsByType(plotType);
        } else {
            plots = prodPlotService.list();
        }
        return ApiResponse.success(plots);
    }

    @GetMapping("/{id}")
    public ApiResponse<ProdPlot> getById(@PathVariable Long id) {
        ProdPlot plot = prodPlotService.getById(id);
        if (plot == null) {
            return ApiResponse.error("地块不存在");
        }
        return ApiResponse.success(plot);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody ProdPlot plot) {
        plot.setDelFlag(0);
        plot.setCreateTime(new Date());
        plot.setUpdateTime(new Date());
        plot.setStatus("active");
        boolean success = prodPlotService.save(plot);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody ProdPlot plot) {
        ProdPlot existing = prodPlotService.getById(id);
        if (existing == null) {
            return ApiResponse.error("地块不存在");
        }
        plot.setId(id);
        plot.setUpdateTime(new Date());
        boolean success = prodPlotService.updateById(plot);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        ProdPlot plot = prodPlotService.getById(id);
        if (plot == null) {
            return ApiResponse.error("地块不存在");
        }
        plot.setDelFlag(1);
        plot.setUpdateTime(new Date());
        boolean success = prodPlotService.updateById(plot);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        boolean success = prodPlotService.updatePlotStatus(id, status);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新状态失败");
    }
}