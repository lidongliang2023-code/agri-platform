package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.service.P2tTradeService;
import com.agri.trade.service.PlatformIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 卖家中心 · 产销对接（**承接侧**）。
 *
 * <p>口径：供给意向由农业生产域的经营主体发布，<b>承接由供应商主体自己决定</b>——
 * 在这里看清"谁的货、多少量、什么窗口"，认领后以<b>我自己的主体号</b>建品定价。
 * 平台运营方不再做这件事（{@code /api/trade/admin/p2t} 的审核与建品已下线，只留对账/差异/规则）。</p>
 *
 * <p>数据范围一律由令牌推出的经营主体集合决定，请求里的 {@code sellerId} 只用于
 * "我绑了多家主体时选一家"，且必须属于我——不校验就等于让人以别人的名义承接货源。</p>
 */
@RestController
@RequestMapping("/api/trade/seller/p2t")
@RequiredArgsConstructor
public class SellerP2tController {

    private final P2tTradeService p2tTradeService;
    private final PlatformIdentityService identityService;

    /** 可承接的意向池：生产端意向 + 本域实查的承接状态（含"已被我承接"）。 */
    @GetMapping("/pool")
    public ApiResponse<Map<String, Object>> pool(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        try {
            return ApiResponse.success(p2tTradeService.claimablePool(pageNum, pageSize, keyword, auditStatus));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /** 承接前看单张意向的完整供给事实（量、窗口、等级结构、质检单号）。 */
    @GetMapping("/offer/{offerNo}")
    public ApiResponse<Map<String, Object>> offer(@PathVariable String offerNo) {
        try {
            return ApiResponse.success(p2tTradeService.offer(offerNo));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /**
     * 承接一张意向：接受并回写生产端 → 以承接方主体号建品 → 回写上架结果。
     *
     * <p>整段在一个事务里：只回写了"接受"却没建出商品，供给侧会显示"已被承接"而交易侧什么都没有，
     * 是最难解释的一种半成功。</p>
     */
    @PostMapping("/pool/{offerNo}/claim")
    public ApiResponse<TradeProduct> claim(@PathVariable String offerNo,
                                           @RequestBody Map<String, Object> payload) {
        try {
            Long sellerId = payload.get("sellerId") == null ? null
                    : Long.valueOf(String.valueOf(payload.get("sellerId")).trim());
            BigDecimal listedQty = payload.get("listedQty") == null ? null
                    : new BigDecimal(String.valueOf(payload.get("listedQty")).trim());
            BigDecimal price = payload.get("price") == null ? null
                    : new BigDecimal(String.valueOf(payload.get("price")).trim());
            return ApiResponse.success(p2tTradeService.claim(offerNo, sellerId, listedQty, price));
        } catch (NumberFormatException e) {
            return ApiResponse.error("承接方主体号、上架量与挂牌价都必须是数字");
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /** 我承接出来的商品（只能看到自己主体名下的）。 */
    @GetMapping("/products")
    public ApiResponse<Map<String, Object>> myProducts(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error("无法确认你所属的经营主体（身份服务不可达）：" + scope.error());
        }
        return ApiResponse.success(p2tTradeService.myProductPage(scope.merchantIds(), pageNum, pageSize, keyword));
    }

    /** 承接方改自己商品的挂牌价（会先证明这件商品确属本主体）。 */
    @PutMapping("/products/{id}/price")
    public ApiResponse<TradeProduct> updatePrice(@PathVariable Long id,
                                                 @RequestBody Map<String, Object> payload) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error("无法确认你所属的经营主体（身份服务不可达）：" + scope.error());
        }
        try {
            Object raw = payload.get("price");
            if (raw == null) {
                throw new IllegalArgumentException("请填写挂牌价");
            }
            return ApiResponse.success(p2tTradeService.updateMyPrice(
                    scope.merchantIds(), id, new BigDecimal(String.valueOf(raw).trim())));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
