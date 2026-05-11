package com.agri.production.controller;

import com.agri.production.dto.PlotPageDTO;
import com.agri.production.dto.PlotSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IPlotService;
import com.agri.production.vo.PlotVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/production/plots")
public class PlotController {

    private final IPlotService plotService;

    public PlotController(IPlotService plotService) {
        this.plotService = plotService;
    }

    @PostMapping
    public ApiResponse<PlotVO> create(@Valid @RequestBody PlotSaveDTO dto) {
        String tenantId = "T001";
        PlotVO vo = plotService.save(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @PutMapping("/{id}")
    public ApiResponse<PlotVO> update(@PathVariable Long id, @Valid @RequestBody PlotSaveDTO dto) {
        dto.setId(id);
        String tenantId = "T001";
        PlotVO vo = plotService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = "T001";
        plotService.delete(id, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    public ApiResponse<PlotVO> getById(@PathVariable Long id) {
        String tenantId = "T001";
        PlotVO vo = plotService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{plotCode}")
    public ApiResponse<PlotVO> getByCode(@PathVariable String plotCode) {
        String tenantId = "T001";
        PlotVO vo = plotService.getByCode(plotCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<PlotVO>> pageQuery(PlotPageDTO dto) {
        String tenantId = "T001";
        PageResult<PlotVO> result = plotService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/farm/{farmId}")
    public ApiResponse<List<PlotVO>> listByFarmId(@PathVariable Long farmId) {
        String tenantId = "T001";
        List<PlotVO> list = plotService.listByFarmId(farmId, tenantId);
        return ApiResponse.success(list);
    }
}