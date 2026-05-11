package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_demand")
public class Demand {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("demand_no")
    private String demandNo;

    @TableField("demand_name")
    private String demandName;

    @TableField("buyer_id")
    private Long buyerId;

    @TableField("buyer_name")
    private String buyerName;

    @TableField("buyer_type")
    private String buyerType;

    @TableField("category_id")
    private Long categoryId;

    @TableField("category_code")
    private String categoryCode;

    @TableField("category_name")
    private String categoryName;

    @TableField("variety")
    private String variety;

    @TableField("product_name")
    private String productName;

    @TableField("spec_desc")
    private String specDesc;

    @TableField("quality_level")
    private String qualityLevel;

    @TableField("quantity")
    private BigDecimal quantity;

    @TableField("demand_quantity")
    private BigDecimal demandQuantity;

    @TableField("unit")
    private String unit;

    @TableField("price_min")
    private BigDecimal priceMin;

    @TableField("price_max")
    private BigDecimal priceMax;

    @TableField("expected_price")
    private BigDecimal expectedPrice;

    @TableField("delivery_province")
    private String deliveryProvince;

    @TableField("delivery_city")
    private String deliveryCity;

    @TableField("delivery_district")
    private String deliveryDistrict;

    @TableField("delivery_address")
    private String deliveryAddress;

    @TableField("delivery_location")
    private String deliveryLocation;

    @TableField("additional_requirements")
    private String additionalRequirements;

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

    @TableField("demand_type")
    private String demandType;

    @TableField("demand_status")
    private String demandStatus;

    @TableField("publish_time")
    private Date publishTime;

    @TableField("expect_response_time")
    private Date expectResponseTime;

    @TableField("match_expire_time")
    private Date matchExpireTime;

    @TableField("response_count")
    private Integer responseCount;

    @TableField("valid_until")
    private Date validUntil;

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