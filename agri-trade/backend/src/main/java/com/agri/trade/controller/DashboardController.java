package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.IDashboardService;
import com.agri.trade.service.PlatformIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 经营看板。
 *
 * <p><b>数据范围</b>：这一组接口原先都是"传谁的 id 就看谁的"——
 * 也就是说任何登录用户换个 id 就能看到别家商家的营业额、TOP 采购商名单
 * （名字都在里面）与热销货源。现在改成：
 * <ul>
 *   <li>{@code /mine}：范围由服务端按登录身份推导，用户端走这一个；</li>
 *   <li>带 id 的那几个：仍然保留（运营/排障要用），但**id 必须属于调用方绑定的主体**。</li>
 * </ul></p>
 */
@RestController
@RequestMapping("/api/trade/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final IDashboardService dashboardService;
    private final PlatformIdentityService identityService;

    /**
     * 我的经营看板：一次返回供方与采方两侧。
     *
     * <p>绑定了多家主体时取第一家的视角（页面上会显示是谁的看板）——
     * 真要做多主体切换，得先有"切换当前主体"这个交互，不在这一轮。</p>
     */
    @GetMapping("/mine")
    public ApiResponse<Map<String, Object>> mine() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        Map<String, Object> result = new LinkedHashMap<>();
        if (!scope.hasBinding()) {
            // 没绑定主体：返回空壳 + 说明，而不是随便挑一个主体给一份别家的数据
            result.put("merchantId", null);
            result.put("merchantName", null);
            result.put("message", "当前账号还没有绑定经营主体，看不到经营看板");
            result.put("seller", null);
            result.put("buyer", null);
            return ApiResponse.success(result);
        }
        Long merchantId = scope.merchantIds().get(0);
        result.put("merchantId", merchantId);
        result.put("merchantName", scope.nameOf(merchantId));
        result.put("seller", dashboardService.getSellerDashboard(merchantId));
        result.put("buyer", dashboardService.getBuyerDashboard(merchantId));
        return ApiResponse.success(result);
    }

    @GetMapping("/seller/{sellerId}")
    public ApiResponse<IDashboardService.SellerDashboard> getSellerDashboard(@PathVariable Long sellerId) {
        String denied = denyUnlessMine(sellerId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getSellerDashboard(sellerId));
    }

    @GetMapping("/buyer/{buyerId}")
    public ApiResponse<IDashboardService.BuyerDashboard> getBuyerDashboard(@PathVariable Long buyerId) {
        String denied = denyUnlessMine(buyerId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getBuyerDashboard(buyerId));
    }

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> getTransactionStats(
            @RequestParam Long userId,
            @RequestParam String userType) {
        String denied = denyUnlessMine(userId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getTransactionStats(userId, userType));
    }

    @GetMapping("/trend")
    public ApiResponse<List<IDashboardService.TransactionTrend>> getTransactionTrend(
            @RequestParam Long userId,
            @RequestParam String userType,
            @RequestParam(defaultValue = "7") int days) {
        String denied = denyUnlessMine(userId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getTransactionTrend(userId, userType, days));
    }

    @GetMapping("/seller/{sellerId}/top-products")
    public ApiResponse<List<IDashboardService.TopProduct>> getTopProducts(
            @PathVariable Long sellerId,
            @RequestParam(defaultValue = "5") int limit) {
        String denied = denyUnlessMine(sellerId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getTopProducts(sellerId, limit));
    }

    @GetMapping("/seller/{sellerId}/top-buyers")
    public ApiResponse<List<IDashboardService.TopBuyer>> getTopBuyers(
            @PathVariable Long sellerId,
            @RequestParam(defaultValue = "5") int limit) {
        String denied = denyUnlessMine(sellerId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getTopBuyers(sellerId, limit));
    }

    @GetMapping("/order-status")
    public ApiResponse<List<IDashboardService.OrderStatusStats>> getOrderStatusDistribution(
            @RequestParam Long userId,
            @RequestParam String userType) {
        String denied = denyUnlessMine(userId);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(dashboardService.getOrderStatusDistribution(userId, userType));
    }

    /**
     * 判权：只能看**自己绑定的主体**的经营数据。
     *
     * <p>TOP 采购商名单里带着别家主体的名字，热销货源带着自家未公开的销量 ——
     * 这些都不是"顺手传个 id"就该看到的。</p>
     */
    private String denyUnlessMine(Long merchantId) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (merchantId != null && scope.merchantIds().contains(merchantId)) {
            return null;
        }
        return "只能查看自己绑定的经营主体的经营数据";
    }
}
