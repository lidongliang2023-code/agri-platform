package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.entity.Plot;
import com.agri.iot.service.IPlotService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/plot")
@RequiredArgsConstructor
public class PlotController {

    private final IPlotService plotService;

    @GetMapping("/page")
    public ApiResponse<PageResult<Plot>> page(
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String cropType,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        return ApiResponse.success(plotService.page(farmId, cropType, pageNum, pageSize));
    }

    @GetMapping("/{id}")
    public ApiResponse<Plot> getDetail(@PathVariable Long id) {
        return ApiResponse.success(plotService.getById(id));
    }

    @GetMapping("/farm/{farmId}")
    public ApiResponse<List<Plot>> listByFarmId(@PathVariable String farmId) {
        return ApiResponse.success(plotService.listByFarmId(farmId));
    }

    @GetMapping("/crop-type/{cropType}")
    public ApiResponse<List<Plot>> listByCropType(@PathVariable String cropType) {
        return ApiResponse.success(plotService.listByCropType(cropType));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody Plot plot) {
        plotService.save(plot);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody Plot plot) {
        plotService.update(id, plot);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        plotService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{plotId}/device-count")
    public ApiResponse<Void> updateDeviceCount(@PathVariable Long plotId, @RequestParam Integer count) {
        plotService.updateDeviceCount(plotId, count);
        return ApiResponse.success();
    }
}