package com.agri.trade.api.dto;

import java.math.BigDecimal;

/**
 * 订单 DTO（OHS 契约）。
 */
public record TradeOrderDTO(Long id, String orderNo, Long buyerMerchantId, Long sellerMerchantId, Long productId,
                            String productName, BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount,
                            String status, String traceCode) {
}
