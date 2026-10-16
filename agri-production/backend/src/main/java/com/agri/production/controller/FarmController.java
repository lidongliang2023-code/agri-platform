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
