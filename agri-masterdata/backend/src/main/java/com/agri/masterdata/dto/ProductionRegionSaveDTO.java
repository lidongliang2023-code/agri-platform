package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductionRegionSaveDTO {

    @NotBlank(message = "产区编码不能为空")
    private String regionCode;

    @NotBlank(message = "产区名称不能为空")
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

    private Integer status = 1;

    private String remark;
}