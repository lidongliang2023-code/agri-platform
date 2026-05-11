package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.IPriceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trade/price")
@RequiredArgsConstructor
public class PriceController {

    private final IPriceService priceService;

    @GetMapping("/recommendation/{productId}")
    public ApiResponse<IPriceService.PriceRecommendation> getRecommendation(@PathVariable Long productId) {
        IPriceService.PriceRecommendation recommendation = priceService.getPriceRecommendation(productId);
        if (recommendation == null) {
            return ApiResponse.error("商品不存在");
        }
        return ApiResponse.success(recommendation);
    }

    @GetMapping("/recommendation/category/{categoryCode}")
    public ApiResponse<IPriceService.PriceRecommendation> getCategoryRecommendation(@PathVariable String categoryCode) {
        IPriceService.PriceRecommendation recommendation = priceService.getPriceRecommendationByCategory(categoryCode);
        if (recommendation == null) {
            return ApiResponse.error("分类不存在");
        }
        return ApiResponse.success(recommendation);
    }

    @GetMapping("/trend/{productId}")
    public ApiResponse<List<IPriceService.PriceTrend>> getPriceTrend(
            @PathVariable Long productId,
            @RequestParam(defaultValue = "7") int days) {
        return ApiResponse.success(priceService.getPriceTrend(productId, days));
    }

    @GetMapping("/trend/category/{categoryCode}")
    public ApiResponse<List<IPriceService.PriceTrend>> getCategoryPriceTrend(
            @PathVariable String categoryCode,
            @RequestParam(defaultValue = "7") int days) {
        return ApiResponse.success(priceService.getCategoryPriceTrend(categoryCode, days));
    }

    @GetMapping("/market/{productName}")
    public ApiResponse<IPriceService.MarketPrice> getMarketPrice(@PathVariable String productName) {
        return ApiResponse.success(priceService.getMarketPrice(productName));
    }

    @GetMapping("/market/category/{categoryCode}")
    public ApiResponse<List<IPriceService.MarketPrice>> getMarketPricesByCategory(@PathVariable String categoryCode) {
        return ApiResponse.success(priceService.getMarketPricesByCategory(categoryCode));
    }

    @GetMapping("/calculate/{productId}")
    public ApiResponse<BigDecimal> calculatePrice(@PathVariable Long productId) {
        return ApiResponse.success(priceService.calculateRecommendedPrice(productId));
    }

    @GetMapping("/range/{categoryCode}")
    public ApiResponse<Map<String, BigDecimal>> getPriceRange(@PathVariable String categoryCode) {
        return ApiResponse.success(priceService.getPriceRange(categoryCode));
    }

    @GetMapping("/average/{categoryCode}")
    public ApiResponse<BigDecimal> getAveragePrice(@PathVariable String categoryCode) {
        return ApiResponse.success(priceService.getMarketAveragePrice(categoryCode));
    }
}