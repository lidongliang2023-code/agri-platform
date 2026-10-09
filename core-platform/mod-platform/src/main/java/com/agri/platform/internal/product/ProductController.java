package com.agri.platform.internal.product;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * 统一商品中心：查询（用户端）+ 管理（云管家）。
 */
@RestController
@RequiredArgsConstructor
public class ProductController {

    private final ProductMapper productMapper;

    public record ProductUpsertRequest(Long categoryId, Long merchantId, String code,
                                       @NotBlank String name, String spec, String unit,
                                       BigDecimal price, BigDecimal stock, Integer status) {
    }

    @GetMapping("/api/v1/products")
    public ApiResponse<PageResult<ProductEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                       @RequestParam(defaultValue = "10") long size,
                                                       @RequestParam(required = false) String keyword,
                                                       @RequestParam(required = false) Integer status) {
        Page<ProductEntity> result = productMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ProductEntity>()
                        .like(keyword != null && !keyword.isBlank(), ProductEntity::getName, keyword)
                        .eq(status != null, ProductEntity::getStatus, status)
                        .orderByDesc(ProductEntity::getCreatedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }

    @GetMapping("/api/v1/products/{id}")
    public ApiResponse<ProductEntity> get(@PathVariable Long id) {
        ProductEntity product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return ApiResponse.ok(product);
    }

    @PostMapping("/api/v1/admin/products")
    public ApiResponse<Long> create(@Valid @RequestBody ProductUpsertRequest req) {
        ProductEntity product = new ProductEntity();
        copy(req, product);
        productMapper.insert(product);
        return ApiResponse.ok(product.getId());
    }

    @PutMapping("/api/v1/admin/products/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @Valid @RequestBody ProductUpsertRequest req) {
        ProductEntity product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        copy(req, product);
        productMapper.updateById(product);
        return ApiResponse.ok();
    }

    @DeleteMapping("/api/v1/admin/products/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        productMapper.deleteById(id);
        return ApiResponse.ok();
    }

    private void copy(ProductUpsertRequest req, ProductEntity product) {
        product.setCategoryId(req.categoryId());
        product.setMerchantId(req.merchantId());
        product.setCode(req.code());
        product.setName(req.name());
        product.setSpec(req.spec());
        product.setUnit(req.unit());
        product.setPrice(req.price());
        product.setStock(req.stock());
        product.setStatus(req.status() == null ? 1 : req.status());
    }
}
