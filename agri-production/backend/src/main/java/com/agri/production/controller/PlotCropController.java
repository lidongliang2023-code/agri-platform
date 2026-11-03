package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.dto.PlotCropSaveDTO;
import com.agri.production.service.TenantContextService;
import com.agri.production.service.impl.PlotCropServiceImpl;
import com.agri.production.vo.PlotCropVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 地块种养品种（{@code /api/v1/production/plots/{plotId}/crops}）。
 *
 * <p>一个地块可登记多个品种，详情页按卡片展示与维护。
 * 地块标识接受本地主键 / 地块编码 / 平台侧标识（DEMO-PLOT-xxx），由 PlotIdResolver 统一换算。</p>
 */
@RestController
@RequestMapping("/api/v1/production/plots/{plotId}")
public class PlotCropController {

    private final PlotCropServiceImpl plotCropService;

    public PlotCropController(PlotCropServiceImpl plotCropService) {
        this.plotCropService = plotCropService;
    }

    /** 地块下的全部种养品种。 */
    @GetMapping("/crops")
    public ApiResponse<List<PlotCropVO>> list(@PathVariable String plotId) {
        return ApiResponse.success(plotCropService.list(TenantContextService.currentTenantId(), plotId));
    }

    /** 新增种养品种，返回新增后的完整记录（含 cropRecordId）。 */
    @PostMapping("/crops")
    public ApiResponse<PlotCropVO> create(@PathVariable String plotId,
                                         @Valid @RequestBody PlotCropSaveDTO dto) {
        return ApiResponse.success(
                plotCropService.create(TenantContextService.currentTenantId(), plotId, dto));
    }

    /** 编辑种养品种。 */
    @PutMapping("/crops/{cropRecordId:\\d+}")
    public ApiResponse<PlotCropVO> update(@PathVariable String plotId,
                                         @PathVariable Long cropRecordId,
                                         @Valid @RequestBody PlotCropSaveDTO dto) {
        return ApiResponse.success(
                plotCropService.update(TenantContextService.currentTenantId(), plotId, cropRecordId, dto));
    }

    /** 删除种养品种（逻辑删除）。 */
    @DeleteMapping("/crops/{cropRecordId:\\d+}")
    public ApiResponse<Void> delete(@PathVariable String plotId,
                                    @PathVariable Long cropRecordId) {
        plotCropService.delete(TenantContextService.currentTenantId(), plotId, cropRecordId);
        return ApiResponse.success();
    }
}
