package com.agri.production.controller;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.dto.FarmSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IFarmService;
import com.agri.production.vo.FarmVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/production/farms")
public class FarmController {

    private final IFarmService farmService;

    public FarmController(IFarmService farmService) {
        this.farmService = farmService;
    }

    @PostMapping
    public ApiResponse<FarmVO> create(@Valid @RequestBody FarmSaveDTO dto) {
        String tenantId = "T001";
        FarmVO vo = farmService.save(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @PutMapping("/{id}")
    public ApiResponse<FarmVO> update(@PathVariable Long id, @Valid @RequestBody FarmSaveDTO dto) {
        dto.setId(id);
        String tenantId = "T001";
        FarmVO vo = farmService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = "T001";
        farmService.delete(id, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmVO> getById(@PathVariable Long id) {
        String tenantId = "T001";
        FarmVO vo = farmService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{farmCode}")
    public ApiResponse<FarmVO> getByCode(@PathVariable String farmCode) {
        String tenantId = "T001";
        FarmVO vo = farmService.getByCode(farmCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<FarmVO>> pageQuery(FarmPageDTO dto) {
        String tenantId = "T001";
        PageResult<FarmVO> result = farmService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }
}