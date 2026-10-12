package com.agri.masterdata.controller.product;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductPageDTO;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.dto.ProductUpdateDTO;
import com.agri.masterdata.service.IProductService;
import com.agri.masterdata.vo.ProductVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/product")
@RequiredArgsConstructor
public class ProductController {

    private final IProductService productService;

    @GetMapping("/page")
    public ApiResponse<PageResult<ProductVO>> page(ProductPageDTO dto) {
        return ApiResponse.success(productService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(productService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid ProductSaveDTO dto) {
        productService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid ProductUpdateDTO dto) {
        productService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        productService.delete(id);
        return ApiResponse.success();
    }
}
