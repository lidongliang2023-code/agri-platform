package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PlotVO {

    private Long id;

    private String plotCode;

    private String plotName;

    private Long farmId;

    private String farmCode;

    private String farmName;

    private BigDecimal area;

    private String shape;

    private String boundary;

    private BigDecimal centerLongitude;

    private BigDecimal centerLatitude;

    private String soilType;

    private BigDecimal soilPh;

    private BigDecimal soilOrganicMatter;

    private String currentCrop;

    private LocalDate plantingDate;

    private LocalDate expectedHarvestDate;

    private String status;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}