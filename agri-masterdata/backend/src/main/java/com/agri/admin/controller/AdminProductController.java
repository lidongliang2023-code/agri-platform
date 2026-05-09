package com.agri.admin.controller;

import com.agri.admin.service.IAdminProductService;
import com.agri.admin.vo.ProductStatisticsVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.vo.ProductVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "商品管理")
@RestController
@RequestMapping("/admin/masterdata/product")
@RequiredArgsConstructor
public class AdminProductController {

    private final IAdminProductService adminProductService;

    @Operation(summary = "获取商品统计概览")
    @GetMapping("/statistics")
    public ApiResponse<ProductStatisticsVO> getProductStatistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String timeRange) {
        return ApiResponse.success(adminProductService.getProductStatistics(tenantId, timeRange));
    }

    @Operation(summary = "获取商品列表")
    @GetMapping("/list")
    public ApiResponse<PageResult<ProductVO>> getProductList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String productCode,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminProductService.getProductList(pageNum, pageSize, productName, productCode, categoryId, status, tenantId));
    }

    @Operation(summary = "获取商品详情")
    @GetMapping("/detail/{id}")
    public ApiResponse<ProductVO> getProductDetail(@PathVariable Long id) {
        return ApiResponse.success(adminProductService.getProductDetail(id));
    }

    @Operation(summary = "创建商品")
    @PostMapping
    public ApiResponse<Void> createProduct(@RequestBody ProductSaveDTO dto) {
        adminProductService.createProduct(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑商品")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateProduct(@PathVariable Long id, @RequestBody ProductSaveDTO dto) {
        adminProductService.updateProduct(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除商品")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteProduct(@PathVariable Long id) {
        adminProductService.deleteProduct(id);
        return ApiResponse.success();
    }

    @Operation(summary = "启用/禁用商品")
    @PutMapping("/{id}/status")
    public ApiResponse<Void> updateProductStatus(@PathVariable Long id, @RequestParam String status) {
        adminProductService.updateProductStatus(id, status);
        return ApiResponse.success();
    }

    @Operation(summary = "导出商品数据")
    @GetMapping("/export")
    public ApiResponse<byte[]> exportProducts(
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminProductService.exportProducts(categoryId, status, tenantId));
    }
}