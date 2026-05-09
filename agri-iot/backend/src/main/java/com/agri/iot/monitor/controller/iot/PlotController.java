package com.agri.monitor.controller.iot;

import com.agri.monitor.dto.PlotPageDTO;
import com.agri.monitor.dto.PlotSaveDTO;
import com.agri.monitor.dto.PlotVO;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IPlotService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/iot/plot")
@RequiredArgsConstructor
@Tag(name = "地块管理")
public class PlotController {

    private final IPlotService plotService;

    @GetMapping("/page")
    @Operation(summary = "地块分页列表")
    public Result<Page<PlotVO>> page(PlotPageDTO dto) {
        return plotService.page(dto);
    }

    @GetMapping("/list")
    @Operation(summary = "地块列表")
    public Result<List<PlotVO>> list() {
        return plotService.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "地块详情")
    public Result<PlotVO> detail(@PathVariable Long id) {
        return plotService.detail(id);
    }

    @PostMapping
    @Operation(summary = "添加地块")
    public Result<Void> save(@RequestBody PlotSaveDTO dto) {
        return plotService.save(dto);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新地块")
    public Result<Void> update(@PathVariable Long id, @RequestBody PlotSaveDTO dto) {
        return plotService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除地块")
    public Result<Void> delete(@PathVariable Long id) {
        return plotService.delete(id);
    }
}
