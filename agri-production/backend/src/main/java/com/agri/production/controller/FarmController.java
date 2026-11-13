package com.agri.production.controller;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.dto.FarmSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IFarmService;
import com.agri.production.vo.FarmVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import com.agri.production.service.TenantContextService;

@RestController
@RequestMapping("/api/v1/production/farms")
public class FarmController {

    private final IFarmService farmService;

    public FarmController(IFarmService farmService) {
        this.farmService = farmService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.production.service.PlotBoundaryService boundaryService;

    @GetMapping("/{id:\\d+}/plot-boundary-checks")
    public ApiResponse<java.util.List<java.util.Map<String,Object>>> boundaryChecks(@PathVariable Long id) {
        return ApiResponse.success(boundaryService.report(boundaryService.farm(id,TenantContextService.currentTenantId(),false)));
    }

    @PostMapping("/{id:\\d+}/plot-boundary-check")
    public ApiResponse<com.agri.production.service.PlotBoundaryService.Result> checkPlotBoundary(@PathVariable Long id, @RequestBody java.util.Map<String,String> body) {
        var farm=boundaryService.farm(id,TenantContextService.currentTenantId(),false);
        Long plotId=null;
        if (body.get("plotId")!=null && !body.get("plotId").isBlank()) {
            try { plotId=Long.valueOf(body.get("plotId")); }
            catch (NumberFormatException e) { throw new com.agri.production.common.exception.BusinessException(400,"地块ID无效"); }
        }
        return ApiResponse.success(boundaryService.preview(farm,body.get("boundary"),plotId));
    }

    @PostMapping
    public ApiResponse<String> create(@Valid @RequestBody FarmSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        FarmVO vo = farmService.save(dto, tenantId);
        // 契约是**返回新农场 id 字符串**（前端 api 注释与平台侧实现都是这个），不是实体对象：
        // 页面拿到之后会直接用它跳转 `/production/farms/<id>`。返回对象时页面的 id 变成
        // "[object Object]"，跳过去之后详情页那一批请求会全部失败（实测 2026-10-16：
        // 农场详情页出现 5 条 400，就是这条契约不一致引起的）。
        return ApiResponse.success(vo.getId() == null ? null : String.valueOf(vo.getId()));
    }

    @PutMapping("/{id:\\d+}")
    public ApiResponse<FarmVO> update(@PathVariable Long id, @Valid @RequestBody FarmSaveDTO dto) {
        dto.setId(id);
        String tenantId = TenantContextService.currentTenantId();
        FarmVO vo = farmService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id:\\d+}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        farmService.delete(id, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/{id:\\d+}")
    public ApiResponse<FarmVO> getById(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        FarmVO vo = farmService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{farmCode}")
    public ApiResponse<FarmVO> getByCode(@PathVariable String farmCode) {
        String tenantId = TenantContextService.currentTenantId();
        FarmVO vo = farmService.getByCode(farmCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<FarmVO>> pageQuery(FarmPageDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PageResult<FarmVO> result = farmService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }
}
