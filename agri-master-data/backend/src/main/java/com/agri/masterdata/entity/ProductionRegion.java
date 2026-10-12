package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_production_region")
public class ProductionRegion extends BaseEntity {

    private String regionCode;

    private String regionName;

    private String parentCode;

    private String regionType;

    private String province;

    private String city;

    private String district;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String climateType;

    private String soilType;

    private String elevation;

    private String rainfall;

    private String sunshineHours;

    private String specialty;

    private String certification;

    private String description;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}