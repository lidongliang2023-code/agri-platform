package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.ProductImage;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.mapper.ProductImageMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 官网门户公开只读接口（2026-10-20）。
 *
 * <p>门户是未登录的公开站点，而交易域其余接口都要求平台访问令牌；如果直接放开
 * {@code /api/trade/product/page}，会把商品管理的查询面整个暴露出去。这里只提供
 * **已发布商品的展示字段**，字段白名单在 DTO 里固定，不返回成本、库存、卖家联系方式等经营数据。</p>
 *
 * <p>该前缀在 {@code WebMvcConfig} 中显式放行，是本模块唯一的匿名业务读入口。</p>
 */
@RestController
@RequestMapping("/api/trade/public")
@RequiredArgsConstructor
public class PortalPublicController {

    private static final int MAX_LIMIT = 24;

    private final TradeProductMapper productMapper;
    private final TradeProductCategoryMapper categoryMapper;
    private final DemandMapper demandMapper;
    private final ProductImageMapper productImageMapper;

    /** 门户展示用的已发布商品（按发布时间倒序）。 */
    @GetMapping("/products")
    public ApiResponse<List<PortalProductView>> products(@RequestParam(defaultValue = "8") Integer limit) {
        int size = limit == null ? 8 : Math.min(Math.max(limit, 1), MAX_LIMIT);
        Page<TradeProduct> page = new Page<>(1, size);
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0)
                .eq(TradeProduct::getPublishStatus, "published")
                .orderByDesc(TradeProduct::getCreateTime);
        List<PortalProductView> items = productMapper.selectPage(page, wrapper).getRecords().stream()
                .map(PortalPublicController::toView)
                .collect(Collectors.toList());
        return ApiResponse.success(items);
    }

    /** 已发布商品详情：只开放买家购买决策所需的展示字段。 */
    @GetMapping("/products/{id}")
    public ApiResponse<PortalProductDetailView> product(@PathVariable Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null || Integer.valueOf(1).equals(product.getDelFlag())
                || !"published".equals(product.getPublishStatus())) {
            return ApiResponse.error("商品不存在或已下架");
        }
        return ApiResponse.success(toDetailView(product));
    }

    /** 已发布商品图库。 */
    @GetMapping("/products/{id}/images")
    public ApiResponse<List<PublicProductImageView>> productImages(@PathVariable Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null || Integer.valueOf(1).equals(product.getDelFlag())
                || !"published".equals(product.getPublishStatus())) {
            return ApiResponse.error("商品不存在或已下架");
        }
        List<PublicProductImageView> images = productImageMapper.selectList(
                        new LambdaQueryWrapper<ProductImage>()
                                .eq(ProductImage::getDelFlag, 0)
                                .eq(ProductImage::getProductId, id)
                                .orderByAsc(ProductImage::getSortOrder))
                .stream()
                .map(item -> new PublicProductImageView(item.getId(), item.getImageUrl(),
                        item.getImageType(), item.getSortOrder()))
                .collect(Collectors.toList());
        return ApiResponse.success(images);
    }

    /** 交易大厅商品分页（公开只读）。 */
    @GetMapping("/hall/products")
    public ApiResponse<PublicPage<PortalProductView>> hallProducts(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "9") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) List<Long> categoryIds,
            @RequestParam(required = false) String categoryName,
            @RequestParam(required = false) List<String> categoryKeywords,
            @RequestParam(required = false) String varietyKeyword,
            @RequestParam(required = false) String province,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String sort) {
        int size = Math.min(Math.max(pageSize == null ? 9 : pageSize, 1), MAX_LIMIT);
        Page<TradeProduct> page = new Page<>(Math.max(pageNum == null ? 1 : pageNum, 1), size);
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0)
                .eq(TradeProduct::getPublishStatus, "published");
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            wrapper.and(w -> w.like(TradeProduct::getProductName, value)
                    .or().like(TradeProduct::getSellerName, value)
                    .or().like(TradeProduct::getVariety, value));
        }
        if ((categoryIds != null && !categoryIds.isEmpty()) || (categoryName != null && !categoryName.isBlank())) {
            wrapper.and(w -> {
                if (categoryIds != null && !categoryIds.isEmpty()) {
                    w.in(TradeProduct::getCategoryId, categoryIds);
                }
                if (categoryName != null && !categoryName.isBlank()) {
                    if (categoryIds != null && !categoryIds.isEmpty()) {
                        w.or().eq(TradeProduct::getCategoryName, categoryName.trim());
                    } else {
                        w.eq(TradeProduct::getCategoryName, categoryName.trim());
                    }
                }
            });
        }
        if (categoryKeywords != null && !categoryKeywords.isEmpty()) {
            List<String> values = categoryKeywords.stream()
                    .filter(item -> item != null && !item.isBlank())
                    .map(String::trim)
                    .distinct()
                    .collect(Collectors.toList());
            if (!values.isEmpty()) {
                wrapper.and(w -> {
                    for (int i = 0; i < values.size(); i++) {
                        String value = values.get(i);
                        if (i == 0) {
                            w.and(x -> x.like(TradeProduct::getCategoryName, value)
                                    .or().like(TradeProduct::getProductName, value)
                                    .or().like(TradeProduct::getVariety, value));
                        } else {
                            w.or(x -> x.like(TradeProduct::getCategoryName, value)
                                    .or().like(TradeProduct::getProductName, value)
                                    .or().like(TradeProduct::getVariety, value));
                        }
                    }
                });
            }
        }
        if (varietyKeyword != null && !varietyKeyword.isBlank()) {
            String value = varietyKeyword.trim();
            wrapper.and(w -> w.like(TradeProduct::getProductName, value)
                    .or().like(TradeProduct::getVariety, value)
                    .or().like(TradeProduct::getCategoryName, value));
        }
        if (province != null && !province.isBlank()) {
            wrapper.like(TradeProduct::getOriginProvince, province.trim());
        }
        if (minPrice != null) wrapper.ge(TradeProduct::getPrice, minPrice);
        if (maxPrice != null) wrapper.le(TradeProduct::getPrice, maxPrice);
        if ("priceAsc".equals(sort)) {
            wrapper.orderByAsc(TradeProduct::getPrice);
        } else if ("priceDesc".equals(sort)) {
            wrapper.orderByDesc(TradeProduct::getPrice);
        } else if ("sales".equals(sort)) {
            wrapper.orderByDesc(TradeProduct::getSalesVolume);
        } else {
            wrapper.orderByDesc(TradeProduct::getCreateTime);
        }
        Page<TradeProduct> result = productMapper.selectPage(page, wrapper);
        List<PortalProductView> records = result.getRecords().stream()
                .map(PortalPublicController::toView)
                .collect(Collectors.toList());
        return ApiResponse.success(new PublicPage<>(records, result.getTotal(), result.getCurrent(), result.getSize()));
    }

    /** 公开分类树（大厅筛选）。 */
    @GetMapping("/categories")
    public ApiResponse<List<PublicCategoryView>> categories() {
        return ApiResponse.success(categoryMapper.selectList(new LambdaQueryWrapper<TradeProductCategory>()
                        .eq(TradeProductCategory::getDelFlag, 0)
                        .eq(TradeProductCategory::getStatus, 1)
                        .orderByAsc(TradeProductCategory::getLevel)
                        .orderByAsc(TradeProductCategory::getSortOrder))
                .stream()
                .map(item -> new PublicCategoryView(item.getId(), item.getParentId(), item.getCategoryName(), item.getLevel()))
                .collect(Collectors.toList()));
    }

    /** 采购需求大厅（公开只读，隐藏联系方式）。 */
    @GetMapping("/demands")
    public ApiResponse<List<PublicDemandView>> demands() {
        return ApiResponse.success(demandMapper.selectList(new LambdaQueryWrapper<Demand>()
                        .eq(Demand::getDelFlag, 0)
                        .in(Demand::getDemandStatus, List.of("pending", "matching", "quoted"))
                        .orderByDesc(Demand::getCreateTime)
                        .last("LIMIT 50"))
                .stream()
                .map(item -> new PublicDemandView(item.getId(), item.getDemandNo(), item.getDemandName(),
                        item.getBuyerName(), item.getProductName(), item.getVariety(), item.getQuantity(), item.getUnit(),
                        item.getPriceMin(), item.getPriceMax(), item.getDeliveryProvince(), item.getDeliveryCity(),
                        item.getDemandStatus(), item.getResponseCount(), item.getCreateTime()))
                .collect(Collectors.toList()));
    }

    private static PortalProductView toView(TradeProduct product) {
        String origin = String.join("", nullToEmpty(product.getOriginProvince()),
                nullToEmpty(product.getOriginCity()), nullToEmpty(product.getOriginDistrict()));
        String specification = firstNonBlank(product.getSpecLevel(), product.getSpecSize(), product.getVariety());
        return new PortalProductView(
                product.getId(),
                product.getProductName(),
                product.getSellerName(),
                product.getCategoryName(),
                product.getVariety(),
                origin,
                specification,
                product.getUnit(),
                product.getPrice(),
                product.getPriceMin(),
                product.getPriceMax(),
                product.getMinOrderQuantity(),
                product.getStockQuantity(),
                product.getSalesVolume(),
                product.getOriginProvince(),
                product.getCategoryId());
    }

    private static PortalProductDetailView toDetailView(TradeProduct product) {
        return new PortalProductDetailView(
                product.getId(),
                product.getProductCode(),
                product.getProductName(),
                product.getCategoryId(),
                product.getCategoryName(),
                product.getSellerId(),
                product.getSellerName(),
                product.getVariety(),
                product.getOriginProvince(),
                product.getOriginCity(),
                product.getOriginDistrict(),
                product.getOriginAddress(),
                product.getSpecLevel(),
                product.getQualityLevel(),
                product.getSpecSize(),
                product.getUnit(),
                product.getStockQuantity(),
                product.getPrice(),
                product.getPriceMin(),
                product.getPriceMax(),
                product.getPriceType(),
                product.getMinOrderQuantity(),
                product.getHarvestBatchNo(),
                product.getCertificationJson(),
                product.getQualityReportUrl(),
                product.getDescription(),
                product.getVideoUrl(),
                product.getViewCount(),
                product.getFavoriteCount(),
                product.getInquiryCount(),
                product.getSalesVolume(),
                product.getPublishStatus(),
                product.getCreateTime());
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /** 门户公开字段（刻意不含库存、成本、联系方式等经营敏感信息）。 */
    public record PortalProductView(
            Long id,
            String productName,
            String sellerName,
            String categoryName,
            String variety,
            String origin,
            String specification,
            String unit,
            BigDecimal price,
            BigDecimal priceMin,
            BigDecimal priceMax,
            BigDecimal minOrderQuantity,
            BigDecimal stockQuantity,
            Integer salesVolume,
            String province,
            Long categoryId) {
    }

    /** 公开详情字段白名单：不含成本、内部审核、租户与联系人等数据。 */
    public record PortalProductDetailView(
            Long id,
            String productCode,
            String productName,
            Long categoryId,
            String categoryName,
            Long sellerId,
            String sellerName,
            String variety,
            String originProvince,
            String originCity,
            String originDistrict,
            String originAddress,
            String specLevel,
            String qualityLevel,
            String specSize,
            String unit,
            BigDecimal stockQuantity,
            BigDecimal price,
            BigDecimal priceMin,
            BigDecimal priceMax,
            String priceType,
            BigDecimal minOrderQuantity,
            String harvestBatchNo,
            String certificationJson,
            String qualityReportUrl,
            String description,
            String videoUrl,
            Integer viewCount,
            Integer favoriteCount,
            Integer inquiryCount,
            Integer salesVolume,
            String publishStatus,
            java.util.Date createTime) {
    }

    public record PublicProductImageView(Long id, String imageUrl, String imageType, Integer sortOrder) {
    }

    public record PublicPage<T>(List<T> records, long total, long pageNum, long pageSize) {
    }

    public record PublicCategoryView(Long id, Long parentId, String categoryName, Integer level) {
    }

    public record PublicDemandView(
            Long id,
            String demandNo,
            String demandName,
            String buyerName,
            String productName,
            String variety,
            BigDecimal quantity,
            String unit,
            BigDecimal priceMin,
            BigDecimal priceMax,
            String deliveryProvince,
            String deliveryCity,
            String demandStatus,
            Integer responseCount,
            java.util.Date createTime) {
    }
}
