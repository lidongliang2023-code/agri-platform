package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.entity.ProductImage;
import com.agri.trade.mapper.ProductImageMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/product")
@RequiredArgsConstructor
public class TradeProductController {

    private final TradeProductMapper productMapper;
    private final TradeProductCategoryMapper categoryMapper;
    private final ProductImageMapper productImageMapper;

    /**
     * 商品图片。
     *
     * <p>商品详情页要展示主图与详情图，而 agri_trade_product_image 表此前没有任何读接口 ——
     * 详情页只能显示一个占位框。这里按 product_id 取，主图排在前。</p>
     */
    @GetMapping("/{id}/images")
    public ApiResponse<List<ProductImage>> getProductImages(@PathVariable Long id) {
        LambdaQueryWrapper<ProductImage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductImage::getDelFlag, 0)
               .eq(ProductImage::getProductId, id)
               .orderByAsc(ProductImage::getSortOrder);
        return ApiResponse.success(productImageMapper.selectList(wrapper));
    }

    @GetMapping("/category/page")
    public ApiResponse<IPage<TradeProductCategory>> getCategoryPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long parentId) {
        Page<TradeProductCategory> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeProductCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProductCategory::getDelFlag, 0);
        wrapper.eq(TradeProductCategory::getStatus, 1);
        if (parentId != null) {
            wrapper.eq(TradeProductCategory::getParentId, parentId);
        }
        wrapper.orderByAsc(TradeProductCategory::getSortOrder);
        return ApiResponse.success(categoryMapper.selectPage(page, wrapper));
    }

    @GetMapping("/category/list")
    public ApiResponse<List<TradeProductCategory>> getCategoryList() {
        LambdaQueryWrapper<TradeProductCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProductCategory::getDelFlag, 0);
        wrapper.eq(TradeProductCategory::getStatus, 1);
        wrapper.orderByAsc(TradeProductCategory::getLevel).orderByAsc(TradeProductCategory::getSortOrder);
        return ApiResponse.success(categoryMapper.selectList(wrapper));
    }

    @PostMapping("/category")
    public ApiResponse<Boolean> createCategory(@RequestBody TradeProductCategory category) {
        category.setDelFlag(0);
        category.setStatus(1);
        category.setCreateTime(new Date());
        category.setUpdateTime(new Date());
        int result = categoryMapper.insert(category);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/category/{id}")
    public ApiResponse<Boolean> updateCategory(@PathVariable Long id, @RequestBody TradeProductCategory category) {
        category.setId(id);
        category.setUpdateTime(new Date());
        int result = categoryMapper.updateById(category);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @DeleteMapping("/category/{id}")
    public ApiResponse<Boolean> deleteCategory(@PathVariable Long id) {
        TradeProductCategory category = categoryMapper.selectById(id);
        if (category == null) return ApiResponse.error("分类不存在");
        category.setDelFlag(1);
        category.setUpdateTime(new Date());
        int result = categoryMapper.updateById(category);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }

    @GetMapping("/page")
    public ApiResponse<IPage<TradeProduct>> getProductPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String publishStatus,
            // 供应商店铺页需要"该店铺的全部货源"，原先没有 sellerId 过滤条件，
            // 只能把全部商品拉回来在前端筛 —— 现在下推到 SQL。
            @RequestParam(required = false) Long sellerId,
            // 列表页的价格排序。取值 price / priceMin / createTime，order 取 asc / desc。
            @RequestParam(required = false) String sortField,
            @RequestParam(required = false) String sortOrder) {
        Page<TradeProduct> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0);
        if (categoryId != null) wrapper.eq(TradeProduct::getCategoryId, categoryId);
        if (productName != null) wrapper.like(TradeProduct::getProductName, productName);
        if (publishStatus != null) wrapper.eq(TradeProduct::getPublishStatus, publishStatus);
        if (sellerId != null) wrapper.eq(TradeProduct::getSellerId, sellerId);
        // 白名单式排序：只认三个已知字段，其他一律回落默认排序 ——
        // 直接把请求参数拼进 orderBy 是 SQL 注入面
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        if ("price".equals(sortField)) {
            wrapper.orderBy(true, asc, TradeProduct::getPrice);
        } else if ("priceMin".equals(sortField)) {
            wrapper.orderBy(true, asc, TradeProduct::getPriceMin);
        } else if ("createTime".equals(sortField)) {
            wrapper.orderBy(true, asc, TradeProduct::getCreateTime);
        } else {
            wrapper.orderByDesc(TradeProduct::getCreateTime);
        }
        return ApiResponse.success(productMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<TradeProduct> getProductById(@PathVariable Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) return ApiResponse.error("商品不存在");
        return ApiResponse.success(product);
    }

    @PostMapping
    public ApiResponse<Boolean> createProduct(@RequestBody TradeProduct product) {
        product.setProductCode("P" + System.currentTimeMillis());
        product.setDelFlag(0);
        product.setStatus(1);
        product.setPublishStatus("draft");
        product.setCreateTime(new Date());
        product.setUpdateTime(new Date());
        int result = productMapper.insert(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateProduct(@PathVariable Long id, @RequestBody TradeProduct product) {
        product.setId(id);
        product.setUpdateTime(new Date());
        int result = productMapper.updateById(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteProduct(@PathVariable Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) return ApiResponse.error("商品不存在");
        product.setDelFlag(1);
        product.setUpdateTime(new Date());
        int result = productMapper.updateById(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/audit")
    public ApiResponse<Boolean> auditProduct(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) return ApiResponse.error("商品不存在");
        product.setPublishStatus(params.get("status"));
        product.setAuditRemark(params.get("remark"));
        product.setAuditTime(new Date());
        product.setAuditor(params.get("auditor"));
        product.setUpdateTime(new Date());
        int result = productMapper.updateById(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }
}
