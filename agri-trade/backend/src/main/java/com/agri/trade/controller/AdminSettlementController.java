package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.Settlement;
import com.agri.trade.service.SettlementService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 结算与分账（运营端）。
 *
 * <p>路径挂在 /api/trade/admin/ 下，因此自动受认证拦截器的运营角色校验保护
 * （SUPER_ADMIN / MARKET_OPS）。</p>
 *
 * <p>口径见 {@link SettlementService} 的类注释：结算时点、平台费率、以及
 * "完成即已结算"这层耦合为什么必须拆开。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/settlement")
@RequiredArgsConstructor
public class AdminSettlementController {

    private final SettlementService settlementService;

    @Operation(summary = "结算概览")
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.success(settlementService.summary());
    }

    @Operation(summary = "待结算订单")
    @GetMapping("/pending")
    public ApiResponse<IPage<Map<String, Object>>> pending(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return ApiResponse.success(settlementService.pendingPage(pageNum, pageSize));
    }

    @Operation(summary = "已结算记录")
    @GetMapping("/page")
    public ApiResponse<IPage<Settlement>> settled(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long sellerId) {
        return ApiResponse.success(settlementService.settledPage(pageNum, pageSize, sellerId));
    }

    /**
     * 结算一笔订单。
     *
     * <p>金额由服务端按订单真实数据重算（货款 × 费率 = 平台服务费，总额 − 服务费 = 卖家应收），
     * 请求体里不接受任何金额。不满足条件（未确认收货 / 未付款 / 已结算）时给出具体原因。</p>
     */
    @Operation(summary = "结算订单")
    @PostMapping("/{orderId}/settle")
    public ApiResponse<Settlement> settle(@PathVariable Long orderId) {
        Settlement settlement = settlementService.settle(orderId, SecurityUtils.getUsername());
        if (settlement == null) {
            return ApiResponse.error("该订单不能结算：需要「已确认收货 / 已完成」且已付款，且没有结算过");
        }
        return ApiResponse.success(settlement);
    }
}
