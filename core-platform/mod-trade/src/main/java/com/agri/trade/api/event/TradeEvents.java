package com.agri.trade.api.event;

import java.math.BigDecimal;

/**
 * 交易域事件契约（即拆分预案）：payload DTO 与 TOPIC 常量同居 api 包，消费方仅依赖本包。
 * 生产侧一律经「本地消息表 + MQ」投递（ADR-003）。
 */
public final class TradeEvents {

    /** 订单已成交（支付成功）→ 结算清算记账、行情与统计、消息通知 */
    public static final String ORDER_DEAL_DONE = "order.deal.done";

    /** 结算已完成 → 供应链金融（还款能力）、财务报表 */
    public static final String PAYMENT_SETTLED = "payment.settled";

    private TradeEvents() {
    }

    public record OrderDealDone(Long orderId, String orderNo, Long buyerMerchantId, Long sellerMerchantId,
                                Long productId, String productName, BigDecimal quantity, BigDecimal amount,
                                Long marketId, String dealAt) {
    }

    public record PaymentSettled(Long orderId, String orderNo, BigDecimal amount, Long marketId, String settledAt) {
    }
}
