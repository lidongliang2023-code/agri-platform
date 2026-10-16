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
import com.agri.production.service.TenantContextService;

@RestController
@RequestMapping("/api/v1/production/plots")
public class PlotController {

    private final IPlotService plotService;

    public PlotController(IPlotService plotService) {
        this.plotService = plotService;
    }

    @PostMapping
    public ApiResponse<String> create(@Valid @RequestBody PlotSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PlotVO vo = plotService.save(dto, tenantId);
        // 同 FarmController.create：契约是返回新地块 id 字符串（页面拿它继续建土壤档案/跳详情）
        return ApiResponse.success(vo.getId() == null ? null : String.valueOf(vo.getId()));
    }

    @PutMapping("/{id:\\d+}")
    public ApiResponse<PlotVO> update(@PathVariable Long id, @Valid @RequestBody PlotSaveDTO dto) {
        dto.setId(id);
        String tenantId = TenantContextService.currentTenantId();
        PlotVO vo = plotService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id:\\d+}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        plotService.delete(id, tenantId);
        return ApiResponse.success();
    }

    /**
     * 启用 / 停用地块（页面地块列表的行内操作）。

     *
     * <p>状态码与页面口径一致：{@code 1 启用 / 0 停用}（库内落 {@code active / inactive}）。
     * 停用时若该地块上还有**在种计划**会被拒（{@link com.agri.production.common.exception.BusinessException}
     * 400，消息里给出计划名与 id），把"正在种的地被停掉、计划却还挂着"这条脏路径堵在写入端。</p>
     */
    @PatchMapping("/{id:\\d+}/status")
    public ApiResponse<PlotVO> changeStatus(@PathVariable Long id,
                                            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(plotService.changeStatus(id, status, tenantId));
    }

    @GetMapping("/{id:\\d+}")
    public ApiResponse<PlotVO> getById(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        PlotVO vo = plotService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{plotCode}")
    public ApiResponse<PlotVO> getByCode(@PathVariable String plotCode) {
        String tenantId = TenantContextService.currentTenantId();
        PlotVO vo = plotService.getByCode(plotCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<PlotVO>> pageQuery(PlotPageDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PageResult<PlotVO> result = plotService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/farm/{farmId}")
    public ApiResponse<List<PlotVO>> listByFarmId(@PathVariable Long farmId) {
        String tenantId = TenantContextService.currentTenantId();
        List<PlotVO> list = plotService.listByFarmId(farmId, tenantId);
        return ApiResponse.success(list);
    }
}
