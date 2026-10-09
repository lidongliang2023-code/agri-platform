package com.agri.trade.internal.order;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 交易订单。状态机：CREATED → PAID → SETTLED；CREATED → CANCELLED。
 * 资金链路：支付回调（幂等验签）+ 本地事务（订单 + 消息表）→ RocketMQ 事务投递（图 5）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("trade_order")
public class TradeOrderEntity extends BaseEntity {

    private String orderNo;
    private Long listingId;
    private Long buyerMerchantId;
    private Long sellerMerchantId;
    private Long productId;
    private String productName;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
    private BigDecimal amount;
    /** CREATED / PAID / SETTLED / CANCELLED */
    private String status;
    private String payNo;
    /** 溯源码（生产域 batch.harvested 事件挂载） */
    private String traceCode;
    private LocalDateTime paidAt;
    private LocalDateTime settledAt;
}
