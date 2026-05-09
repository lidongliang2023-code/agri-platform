package com.agri.masterdata.controller.product;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.entity.ProductCategory;
import com.agri.masterdata.service.IProductCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/master-data/products/categories")
@RequiredArgsConstructor
public class ProductCategoryController {

    private final IProductCategoryService categoryService;

    @GetMapping("/tree")
    public ApiResponse<List<ProductCategory>> getCategoryTree(@RequestParam(required = false) Long parentId) {
        List<ProductCategory> tree = categoryService.getCategoryTree(parentId);
        return ApiResponse.success(tree);
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductCategory> getById(@PathVariable Long id) {
        ProductCategory category = categoryService.getById(id);
        return ApiResponse.success(category);
    }

    @GetMapping
    public ApiResponse<List<ProductCategory>> listAll() {
        List<ProductCategory> categories = categoryService.listAll();
        return ApiResponse.success(categories);
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody ProductCategory category) {
        categoryService.save(category);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody ProductCategory category) {
        categoryService.update(id, category);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{categoryId}/attributes")
    public ApiResponse<Map<String, Object>> getCategoryAttributes(@PathVariable Long categoryId) {
        Map<String, Object> attributes = categoryService.getCategoryAttributes(categoryId);
        return ApiResponse.success(attributes);
    }

    @PutMapping("/{categoryId}/attributes")
    public ApiResponse<Void> saveCategoryAttributes(@PathVariable Long categoryId, @RequestBody Map<String, Object> attributes) {
        categoryService.saveCategoryAttributes(categoryId, attributes);
        return ApiResponse.success();
    }
}