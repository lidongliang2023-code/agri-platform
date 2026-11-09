package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.RefundRecord;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.RefundRecordMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.Map;

/** 仅提供当前卖方的账务结果核验，不执行退款，也不输出金额、联系人和地址。 */
@RestController
@RequestMapping("/api/trade/diff-evidence")
@RequiredArgsConstructor
public class TradeDiffEvidenceController {
    private final TradeOrderMapper orders;
    private final RefundRecordMapper refunds;
    private final PlatformIdentityService identity;
    private final com.agri.trade.mapper.LogisticsMapper logistics;


    @GetMapping("/refund")
    public ApiResponse<Map<String, Object>> refund(@RequestParam String offerNo, @RequestParam String orderNo,
                                                  @RequestParam String refundNo, @RequestParam Long subjectId) {
        var scope = identity.currentScope();
        if (!scope.resolved()) return ApiResponse.error(401, "登录凭证无效");
        if (subjectId == null || !scope.merchantIds().contains(subjectId)) return ApiResponse.error(403, "无权核验该主体");
        if (offerNo.isBlank() || orderNo.isBlank() || refundNo.isBlank() || offerNo.length() > 64 || orderNo.length() > 64 || refundNo.length() > 64)
            return ApiResponse.error(400, "核验单号无效");
        TradeOrder order = orders.selectOne(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getOrderNo, orderNo.trim()).eq(TradeOrder::getSourceOfferNo, offerNo.trim())
                .eq(TradeOrder::getSellerId, subjectId).eq(TradeOrder::getDelFlag, 0));
        if (order == null) return ApiResponse.error(404, "关联订单不存在");
        RefundRecord refund = refunds.selectOne(new LambdaQueryWrapper<RefundRecord>()
                .eq(RefundRecord::getRefundNo, refundNo.trim()).eq(RefundRecord::getOrderId, order.getId())
                .eq(RefundRecord::getOrderNo, order.getOrderNo()).eq(RefundRecord::getDelFlag, 0));
        boolean verified = refund != null && "approved".equals(refund.getRefundStatus())
                && refund.getRefundTime() != null && refund.getFinishTime() != null
                && refund.getRefundAmount() != null && refund.getRefundAmount().signum() > 0
                && "refunded".equals(order.getPaymentStatus()) && "refunded".equals(order.getOrderStatus())
                && order.getPaidAmount() != null && order.getPaidAmount().signum() > 0
                && order.getRefundAmount() != null && order.getRefundAmount().compareTo(order.getPaidAmount()) == 0
                && refund.getRefundAmount().compareTo(order.getPaidAmount()) <= 0;
        return ApiResponse.success(Map.of("verified", verified, "scope", "TRADE_LEDGER_FULL_REFUND"));
    }
    @GetMapping("/reship")
    public ApiResponse<Map<String, Object>> reship(@RequestParam String offerNo, @RequestParam String orderNo,
            @RequestParam String ticketNo, @RequestParam String logisticsNo, @RequestParam BigDecimal quantity,
            @RequestParam String unit, @RequestParam Long subjectId) {
        var scope = identity.currentScope();
        if (!scope.resolved()) return ApiResponse.error(401, "登录凭据无效");
        if (subjectId == null || !scope.merchantIds().contains(subjectId)) return ApiResponse.error(403, "无权核验该主体");
        if (java.util.stream.Stream.of(offerNo, orderNo, ticketNo, logisticsNo, unit).anyMatch(v -> v == null || v.isBlank() || v.length() > 64)
                || quantity == null || quantity.signum() <= 0) return ApiResponse.error(400, "补发核验参数无效");
        TradeOrder order = orders.selectOne(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getOrderNo, orderNo.trim()).eq(TradeOrder::getSourceOfferNo, offerNo.trim())
                .eq(TradeOrder::getSellerId, subjectId).eq(TradeOrder::getDelFlag, 0));
        if (order == null) return ApiResponse.error(404, "关联订单不存在");
        var row = logistics.selectOne(new LambdaQueryWrapper<com.agri.trade.entity.Logistics>()
                .eq(com.agri.trade.entity.Logistics::getLogisticsNo, logisticsNo.trim())
                .eq(com.agri.trade.entity.Logistics::getOrderId, order.getId())
                .eq(com.agri.trade.entity.Logistics::getDiffTicketNo, ticketNo.trim())
                .eq(com.agri.trade.entity.Logistics::getDiffSubjectId, subjectId)
                .eq(com.agri.trade.entity.Logistics::getDelFlag, 0));
        boolean verified = row != null && "delivered".equals(row.getLogisticsStatus())
                && row.getSignTime() != null && order.getBuyerId() != null
                && order.getBuyerId().equals(row.getSignedBuyerId())
                && row.getReshipQty() != null && row.getReshipQty().compareTo(quantity) == 0
                && unit.trim().equals(row.getReshipUnit()) && orderNo.trim().equals(row.getOrderNo());
        return ApiResponse.success(Map.of("verified", verified, "scope", "BUYER_SIGNED_RESHIP"));
    }
}
