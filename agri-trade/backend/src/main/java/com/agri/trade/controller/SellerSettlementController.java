package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Settlement;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.SettlementMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.service.TradeConfigService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 卖家侧结算（2026-10-20）。
 *
 * <p>交易域原先只有运营端结算接口，卖家中心看不到"哪些订单待结算、平台扣了多少、自己应收多少"。
 * 这里补一个只读视角，范围由登录令牌推导：</p>
 * <ul>
 *   <li>待结算 = 已确认收货（received/completed）且已付款、尚未生成结算单的订单；</li>
 *   <li>服务费按配置费率对货款预估，最终金额以运营端结算落库为准；</li>
 *   <li>已结算直接读 agri_trade_settlement，不再另算一套口径。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/trade/settlement")
@RequiredArgsConstructor
public class SellerSettlementController {

    private static final String FEE_RATE_KEY = "settlement.platform-fee-rate";
    private static final Set<String> SETTLEABLE_STATUS = Set.of("received", "completed");

    private final SettlementMapper settlementMapper;
    private final TradeOrderMapper orderMapper;
    private final TradeConfigService configService;
    private final PlatformIdentityService identityService;

    @Value("${agri.trade.settlement.platform-fee-rate:0.005}")
    private BigDecimal defaultFeeRate;

    /** 我的结算概览 + 待结算 + 已结算。 */
    @GetMapping("/mine")
    public ApiResponse<SellerSettlementView> mine() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (!scope.hasBinding()) {
            return ApiResponse.success(new SellerSettlementView(
                    zeroSummary(), List.of(), List.of()));
        }
        List<Long> mine = scope.merchantIds();

        List<Settlement> settled = settlementMapper.selectList(new LambdaQueryWrapper<Settlement>()
                .eq(Settlement::getDelFlag, 0)
                .in(Settlement::getSellerId, mine)
                .orderByDesc(Settlement::getSettleTime));
        Set<Long> settledOrderIds = settled.stream().map(Settlement::getOrderId).collect(Collectors.toSet());

        LambdaQueryWrapper<TradeOrder> pendingWrapper = new LambdaQueryWrapper<>();
        pendingWrapper.eq(TradeOrder::getDelFlag, 0)
                .eq(TradeOrder::getPaymentStatus, "paid")
                .in(TradeOrder::getOrderStatus, SETTLEABLE_STATUS)
                .in(TradeOrder::getSellerId, mine);
        if (!settledOrderIds.isEmpty()) {
            pendingWrapper.notIn(TradeOrder::getId, settledOrderIds);
        }
        pendingWrapper.orderByAsc(TradeOrder::getCreateTime);
        List<PendingSettlementRow> pending = orderMapper.selectList(pendingWrapper).stream()
                .map(this::toPending)
                .collect(Collectors.toList());

        BigDecimal pendingAmount = pending.stream().map(PendingSettlementRow::totalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingFee = pending.stream().map(PendingSettlementRow::platformFee)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingReceivable = pending.stream().map(PendingSettlementRow::sellerReceivable)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal settledAmount = settled.stream().map(item -> nullToZero(item.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal settledFee = settled.stream().map(item -> nullToZero(item.getPlatformFee()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal settledReceivable = settled.stream().map(item -> nullToZero(item.getSellerReceivable()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ApiResponse.success(new SellerSettlementView(
                new SettlementSummary(pending.size(), settled.size(), pendingAmount, pendingFee, pendingReceivable,
                        settledAmount, settledFee, settledReceivable),
                pending,
                settled));
    }

    private PendingSettlementRow toPending(TradeOrder order) {
        BigDecimal total = nullToZero(order.getTotalAmount());
        BigDecimal goods = order.getGoodsAmount() == null ? total : nullToZero(order.getGoodsAmount());
        BigDecimal rate = configService.getDecimal(FEE_RATE_KEY, defaultFeeRate);
        BigDecimal fee = goods.multiply(rate).setScale(2, RoundingMode.HALF_UP);
        return new PendingSettlementRow(order.getId(), order.getOrderNo(), order.getSellerId(), order.getSellerName(),
                order.getBuyerName(), total, rate, fee, total.subtract(fee).setScale(2, RoundingMode.HALF_UP),
                order.getOrderStatus());
    }

    private static SettlementSummary zeroSummary() {
        return new SettlementSummary(0, 0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    public record SellerSettlementView(
            SettlementSummary summary,
            List<PendingSettlementRow> pending,
            List<Settlement> settled) {
    }

    public record SettlementSummary(
            int pendingCount,
            int settledCount,
            BigDecimal pendingAmount,
            BigDecimal pendingFee,
            BigDecimal pendingReceivable,
            BigDecimal settledAmount,
            BigDecimal settledFee,
            BigDecimal settledReceivable) {
    }

    public record PendingSettlementRow(
            Long orderId,
            String orderNo,
            Long sellerId,
            String sellerName,
            String buyerName,
            BigDecimal totalAmount,
            BigDecimal platformFeeRate,
            BigDecimal platformFee,
            BigDecimal sellerReceivable,
            String orderStatus) {
    }
}
