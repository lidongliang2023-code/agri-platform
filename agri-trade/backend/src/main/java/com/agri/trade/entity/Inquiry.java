package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_inquiry")
public class Inquiry {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("inquiry_no")
    private String inquiryNo;

    @TableField("demand_id")
    private Long demandId;

    @TableField("demand_no")
    private String demandNo;

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

    @TableField("category_id")
    private Long categoryId;

    @TableField("category_name")
    private String categoryName;

    @TableField("variety")
    private String variety;

    @TableField("quantity")
    private BigDecimal quantity;

    @TableField("unit")
    private String unit;

    @TableField("price_min")
    private BigDecimal priceMin;

    @TableField("price_max")
    private BigDecimal priceMax;

    @TableField("delivery_province")
    private String deliveryProvince;

    @TableField("delivery_city")
    private String deliveryCity;

    @TableField("delivery_address")
    private String deliveryAddress;

    @TableField("delivery_deadline")
    private Date deliveryDeadline;

    @TableField("quality_requirement")
    private String qualityRequirement;

    @TableField("certification_require")
    private String certificationRequire;

    @TableField("sample_require")
    private Integer sampleRequire;

    @TableField("packaging_require")
    private String packagingRequire;

    @TableField("remark")
    private String remark;

    @TableField("inquiry_status")
    private String inquiryStatus;

    @TableField("reply_deadline")
    private Date replyDeadline;

    @TableField("reply_count")
    private Integer replyCount;

    @TableField("order_id")
    private Long orderId;

    @TableField("convert_time")
    private Date convertTime;

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
}