package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_input_product")
public class InputProduct {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("product_code")
    private String productCode;

    @TableField("product_name")
    private String productName;

    @TableField("category")
    private String category;

    @TableField("sub_category")
    private String subCategory;

    @TableField("spec")
    private String spec;

    @TableField("unit")
    private String unit;

    @TableField("pack_size")
    private String packSize;

    @TableField("manufacturer")
    private String manufacturer;

    @TableField("registration_no")
    private String registrationNo;

    @TableField("production_license")
    private String productionLicense;

    @TableField("valid_until")
    private Date validUntil;

    @TableField("storage_condition")
    private String storageCondition;

    @TableField("hazard_level")
    private String hazardLevel;

    @TableField("forbidden_use")
    private String forbiddenUse;

    @TableField("usage_instruction")
    private String usageInstruction;

    @TableField("dosage_recommendation")
    private String dosageRecommendation;

    @TableField("withdrawal_period")
    private Integer withdrawalPeriod;

    @TableField("forbidden")
    private Integer forbidden;

    @TableField("forbidden_reason")
    private String forbiddenReason;

    @TableField("safety_stock")
    private BigDecimal safetyStock;

    @TableField("unit_cost")
    private BigDecimal unitCost;

    @TableField("bar_code")
    private String barCode;

    @TableField("image_url")
    private String imageUrl;

    @TableField("status")
    private String status;

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