package com.agri.masterdata.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductionRegionVO {

    private Long id;

    private String regionCode;

    private String regionName;

    private String parentCode;

    private String parentName;

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

    private String remark;
}