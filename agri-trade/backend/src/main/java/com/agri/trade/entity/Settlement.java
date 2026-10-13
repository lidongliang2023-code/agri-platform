package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 订单结算分账记录。
 *
 * <p>为什么单独一张表：订单上的 settle_status / settle_time 只能表达"结没结"，
 * 表达不了**分账口径** —— 平台服务费按什么费率、收了多少、卖家实收多少。
 * 这三样要留痕，否则事后对不上账，也没法向买卖双方解释"这笔钱为什么少了这些"。</p>
 */
@Data
@TableName("agri_trade_settlement")
public class Settlement {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String settlementNo;

    private Long orderId;

    private String orderNo;

    private Long buyerId;

    private String buyerName;

    private Long sellerId;

    private String sellerName;

    private BigDecimal goodsAmount;

    private BigDecimal freightAmount;

    private BigDecimal totalAmount;

    /** 平台服务费率（按货款计） */
    private BigDecimal platformFeeRate;

    private BigDecimal platformFee;

    /** 卖家应收 = 订单总额 − 平台服务费 */
    private BigDecimal sellerReceivable;

    private String settleStatus;

    private Date settleTime;

    private String settleBy;

    private String remark;

    private Integer delFlag;

    private Date createTime;

    private Date updateTime;
}
