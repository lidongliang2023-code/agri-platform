package com.agri.masterdata.controller.address;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductionRegionSaveDTO;
import com.agri.masterdata.dto.ProductionRegionUpdateDTO;
import com.agri.masterdata.service.IProductionRegionService;
import com.agri.masterdata.vo.ProductionRegionVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/address/production-region")
@RequiredArgsConstructor
@Tag(name = "产区管理", description = "农业产区管理接口")
public class ProductionRegionController {

    private final IProductionRegionService productionRegionService;

    @GetMapping("/page")
    @Operation(summary = "分页查询产区")
    public ApiResponse<PageResult<ProductionRegionVO>> page(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") Integer pageSize,
            @Parameter(description = "产区名称") @RequestParam(required = false) String regionName,
            @Parameter(description = "产区类型") @RequestParam(required = false) String regionType) {
        return ApiResponse.success(productionRegionService.page(pageNum, pageSize, regionName, regionType));
    }

    @GetMapping("/parent/{parentCode}")
    @Operation(summary = "根据父级编码查询子产区")
    public ApiResponse<List<ProductionRegionVO>> listByParentCode(@Parameter(description = "父级编码") @PathVariable String parentCode) {
        return ApiResponse.success(productionRegionService.listByParentCode(parentCode));
    }

    @GetMapping("/type/{regionType}")
    @Operation(summary = "根据产区类型查询")
    public ApiResponse<List<ProductionRegionVO>> listByRegionType(@Parameter(description = "产区类型") @PathVariable String regionType) {
        return ApiResponse.success(productionRegionService.listByRegionType(regionType));
    }

    @GetMapping("/province/{province}")
    @Operation(summary = "根据省份查询产区")
    public ApiResponse<List<ProductionRegionVO>> listByProvince(@Parameter(description = "省份") @PathVariable String province) {
        return ApiResponse.success(productionRegionService.listByProvince(province));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取产区详情")
    public ApiResponse<ProductionRegionVO> getById(@Parameter(description = "产区ID") @PathVariable Long id) {
        return ApiResponse.success(productionRegionService.getById(id));
    }

    @GetMapping("/code/{regionCode}")
    @Operation(summary = "根据产区编码获取产区")
    public ApiResponse<ProductionRegionVO> getByRegionCode(@Parameter(description = "产区编码") @PathVariable String regionCode) {
        return ApiResponse.success(productionRegionService.getByRegionCode(regionCode));
    }

    @PostMapping
    @Operation(summary = "新增产区")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> save(@Valid @RequestBody ProductionRegionSaveDTO dto) {
        productionRegionService.save(dto);
        return ApiResponse.created();
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新产区")
    public ApiResponse<Void> update(@Parameter(description = "产区ID") @PathVariable Long id,
                                    @Valid @RequestBody ProductionRegionUpdateDTO dto) {
        productionRegionService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除产区")
    public ApiResponse<Void> delete(@Parameter(description = "产区ID") @PathVariable Long id) {
        productionRegionService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "修改产区状态")
    public ApiResponse<Void> changeStatus(@Parameter(description = "产区ID") @PathVariable Long id,
                                          @Parameter(description = "状态：1-启用，0-禁用") @RequestParam Integer status) {
        productionRegionService.changeStatus(id, status);
        return ApiResponse.success();
    }
}