package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_order")
public class TradeOrder {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("order_no")
    private String orderNo;

    @TableField("demand_id")
    private Long demandId;

    @TableField("contract_id")
    private Long contractId;

    @TableField("buyer_id")
    private Long buyerId;

    @TableField("buyer_name")
    private String buyerName;

    @TableField("buyer_phone")
    private String buyerPhone;

    @TableField("buyer_type")
    private String buyerType;

    @TableField("seller_id")
    private Long sellerId;

    @TableField("seller_name")
    private String sellerName;

    @TableField("seller_phone")
    private String sellerPhone;

    @TableField("category_id")
    private Long categoryId;

    @TableField("category_name")
    private String categoryName;

    @TableField("goods_amount")
    private BigDecimal goodsAmount;

    @TableField("freight_amount")
    private BigDecimal freightAmount;

    @TableField("discount_amount")
    private BigDecimal discountAmount;

    @TableField("total_amount")
    private BigDecimal totalAmount;

    @TableField("paid_amount")
    private BigDecimal paidAmount;

    @TableField("refund_amount")
    private BigDecimal refundAmount;

    @TableField("currency")
    private String currency;

    @TableField("payment_method")
    private String paymentMethod;

    @TableField("payment_status")
    private String paymentStatus;

    @TableField("order_status")
    private String orderStatus;

    @TableField("delivery_province")
    private String deliveryProvince;

    @TableField("delivery_city")
    private String deliveryCity;

    @TableField("delivery_district")
    private String deliveryDistrict;

    @TableField("delivery_address")
    private String deliveryAddress;

    @TableField("delivery_contact")
    private String deliveryContact;

    @TableField("delivery_phone")
    private String deliveryPhone;

    @TableField("delivery_deadline")
    private Date deliveryDeadline;

    @TableField("logistics_id")
    private Long logisticsId;

    @TableField("logistics_no")
    private String logisticsNo;

    @TableField("logistics_status")
    private String logisticsStatus;

    @TableField("sign_time")
    private Date signTime;

    @TableField("payment_deadline")
    private Date paymentDeadline;

    @TableField("ship_deadline")
    private Date shipDeadline;

    @TableField("confirm_deadline")
    private Date confirmDeadline;

    @TableField("buyer_confirmed")
    private Integer buyerConfirmed;

    @TableField("buyer_confirm_time")
    private Date buyerConfirmTime;

    @TableField("buyer_remark")
    private String buyerRemark;

    @TableField("seller_remark")
    private String sellerRemark;

    @TableField("admin_remark")
    private String adminRemark;

    @TableField("source")
    private String source;

    @TableField("dispute_id")
    private Long disputeId;

    @TableField("compensation_amount")
    private BigDecimal compensationAmount;

    @TableField("settle_status")
    private String settleStatus;

    @TableField("settle_time")
    private Date settleTime;

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