package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
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
                product.getPriceMax());
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
            BigDecimal priceMax) {
    }
}
