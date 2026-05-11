package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_carrier")
public class Carrier {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("carrier_code")
    private String carrierCode;

    @TableField("carrier_name")
    private String carrierName;

    @TableField("carrier_type")
    private String carrierType;

    @TableField("contact_person")
    private String contactPerson;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("service_phone")
    private String servicePhone;

    @TableField("province")
    private String province;

    @TableField("city")
    private String city;

    @TableField("address")
    private String address;

    @TableField("business_license_url")
    private String businessLicenseUrl;

    @TableField("transport_license_url")
    private String transportLicenseUrl;

    @TableField("service_scope")
    private String serviceScope;

    @TableField("coverage_cities")
    private String coverageCities;

    @TableField("avg_delivery_hours")
    private BigDecimal avgDeliveryHours;

    @TableField("rating")
    private BigDecimal rating;

    @TableField("order_count")
    private Integer orderCount;

    @TableField("on_time_rate")
    private BigDecimal onTimeRate;

    @TableField("damage_rate")
    private BigDecimal damageRate;

    @TableField("status")
    private Integer status;

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