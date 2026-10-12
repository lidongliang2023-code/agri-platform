package com.agri.masterdata.controller.product;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.ProductAttributeSaveDTO;
import com.agri.masterdata.dto.ProductAttributeUpdateDTO;
import com.agri.masterdata.service.IProductAttributeService;
import com.agri.masterdata.vo.ProductAttributeVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/product/attribute")
@RequiredArgsConstructor
@Tag(name = "商品属性管理", description = "商品属性模板管理接口")
public class ProductAttributeController {

    private final IProductAttributeService productAttributeService;

    @GetMapping
    @Operation(summary = "查询属性列表")
    public ApiResponse<List<ProductAttributeVO>> list(@Parameter(description = "分类ID") @RequestParam(required = false) Long categoryId) {
        return ApiResponse.success(productAttributeService.list(categoryId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取属性详情")
    public ApiResponse<ProductAttributeVO> getById(@Parameter(description = "属性ID") @PathVariable Long id) {
        return ApiResponse.success(productAttributeService.getById(id));
    }

    @PostMapping
    @Operation(summary = "新增属性")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> save(@Valid @RequestBody ProductAttributeSaveDTO dto) {
        productAttributeService.save(dto);
        return ApiResponse.created();
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新属性")
    public ApiResponse<Void> update(@Parameter(description = "属性ID") @PathVariable Long id,
                                    @Valid @RequestBody ProductAttributeUpdateDTO dto) {
        productAttributeService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除属性")
    public ApiResponse<Void> delete(@Parameter(description = "属性ID") @PathVariable Long id) {
        productAttributeService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "修改属性状态")
    public ApiResponse<Void> changeStatus(@Parameter(description = "属性ID") @PathVariable Long id,
                                          @Parameter(description = "状态：1-启用，0-禁用") @RequestParam Integer status) {
        productAttributeService.changeStatus(id, status);
        return ApiResponse.success();
    }
}