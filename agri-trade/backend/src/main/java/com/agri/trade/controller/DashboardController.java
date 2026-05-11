package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.IDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trade/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final IDashboardService dashboardService;

    @GetMapping("/seller/{sellerId}")
    public ApiResponse<IDashboardService.SellerDashboard> getSellerDashboard(@PathVariable Long sellerId) {
        return ApiResponse.success(dashboardService.getSellerDashboard(sellerId));
    }

    @GetMapping("/buyer/{buyerId}")
    public ApiResponse<IDashboardService.BuyerDashboard> getBuyerDashboard(@PathVariable Long buyerId) {
        return ApiResponse.success(dashboardService.getBuyerDashboard(buyerId));
    }

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> getTransactionStats(
            @RequestParam Long userId,
            @RequestParam String userType) {
        return ApiResponse.success(dashboardService.getTransactionStats(userId, userType));
    }

    @GetMapping("/trend")
    public ApiResponse<List<IDashboardService.TransactionTrend>> getTransactionTrend(
            @RequestParam Long userId,
            @RequestParam String userType,
            @RequestParam(defaultValue = "7") int days) {
        return ApiResponse.success(dashboardService.getTransactionTrend(userId, userType, days));
    }

    @GetMapping("/seller/{sellerId}/top-products")
    public ApiResponse<List<IDashboardService.TopProduct>> getTopProducts(
            @PathVariable Long sellerId,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.success(dashboardService.getTopProducts(sellerId, limit));
    }

    @GetMapping("/seller/{sellerId}/top-buyers")
    public ApiResponse<List<IDashboardService.TopBuyer>> getTopBuyers(
            @PathVariable Long sellerId,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.success(dashboardService.getTopBuyers(sellerId, limit));
    }

    @GetMapping("/order-status")
    public ApiResponse<List<IDashboardService.OrderStatusStats>> getOrderStatusDistribution(
            @RequestParam Long userId,
            @RequestParam String userType) {
        return ApiResponse.success(dashboardService.getOrderStatusDistribution(userId, userType));
    }
}