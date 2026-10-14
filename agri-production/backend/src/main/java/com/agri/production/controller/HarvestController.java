package com.agri.production.controller;

import com.agri.production.dto.HarvestPageDTO;
import com.agri.production.dto.HarvestSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IHarvestService;
import com.agri.production.vo.HarvestVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import com.agri.production.service.TenantContextService;

@RestController
@RequestMapping("/api/v1/production/harvests")
public class HarvestController {

    private final IHarvestService harvestService;

    public HarvestController(IHarvestService harvestService) {
        this.harvestService = harvestService;
    }

    @PostMapping
    public ApiResponse<HarvestVO> create(@Valid @RequestBody HarvestSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        HarvestVO vo = harvestService.save(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @PutMapping("/{id}")
    public ApiResponse<HarvestVO> update(@PathVariable Long id, @Valid @RequestBody HarvestSaveDTO dto) {
        dto.setId(id);
        String tenantId = TenantContextService.currentTenantId();
        HarvestVO vo = harvestService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        harvestService.delete(id, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    public ApiResponse<HarvestVO> getById(@PathVariable Long id) {
        String tenantId = TenantContextService.currentTenantId();
        HarvestVO vo = harvestService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{harvestCode}")
    public ApiResponse<HarvestVO> getByCode(@PathVariable String harvestCode) {
        String tenantId = TenantContextService.currentTenantId();
        HarvestVO vo = harvestService.getByCode(harvestCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<HarvestVO>> pageQuery(HarvestPageDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        PageResult<HarvestVO> result = harvestService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/farm/{farmId}")
    public ApiResponse<List<HarvestVO>> listByFarmId(@PathVariable Long farmId) {
        String tenantId = TenantContextService.currentTenantId();
        List<HarvestVO> list = harvestService.listByFarmId(farmId, tenantId);
        return ApiResponse.success(list);
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<HarvestVO> complete(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        BigDecimal actualQuantity = new BigDecimal(body.get("actualQuantity").toString());
        String qualityGrade = (String) body.get("qualityGrade");
        HarvestVO vo = harvestService.complete(id, actualQuantity, qualityGrade, tenantId);
        return ApiResponse.success(vo);
    }
}