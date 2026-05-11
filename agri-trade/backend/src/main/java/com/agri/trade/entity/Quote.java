package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_quote")
public class Quote {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("quote_no")
    private String quoteNo;

    @TableField("inquiry_id")
    private Long inquiryId;

    @TableField("inquiry_no")
    private String inquiryNo;

    @TableField("product_id")
    private Long productId;

    @TableField("product_name")
    private String productName;

    @TableField("buyer_id")
    private Long buyerId;

    @TableField("buyer_name")
    private String buyerName;

    @TableField("seller_id")
    private Long sellerId;

    @TableField("seller_name")
    private String sellerName;

    @TableField("unit_price")
    private BigDecimal unitPrice;

    @TableField("quantity")
    private BigDecimal quantity;

    @TableField("unit")
    private String unit;

    @TableField("total_amount")
    private BigDecimal totalAmount;

    @TableField("quote_amount")
    private BigDecimal quoteAmount;

    @TableField("freight_amount")
    private BigDecimal freightAmount;

    @TableField("discount_amount")
    private BigDecimal discountAmount;

    @TableField("payment_terms")
    private String payment_terms;

    @TableField("delivery_time")
    private Date deliveryTime;

    @TableField("delivery_deadline")
    private Date deliveryDeadline;

    @TableField("delivery_address")
    private String deliveryAddress;

    @TableField("quality_description")
    private String qualityDescription;

    @TableField("certification_info")
    private String certificationInfo;

    @TableField("packaging_info")
    private String packagingInfo;

    @TableField("valid_until")
    private Date validUntil;

    @TableField("quote_status")
    private String quoteStatus;

    @TableField("buyer_response")
    private String buyerResponse;

    @TableField("response_time")
    private Date responseTime;

    @TableField("order_id")
    private Long orderId;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;

    @TableField("remark")
    private String remark;
}