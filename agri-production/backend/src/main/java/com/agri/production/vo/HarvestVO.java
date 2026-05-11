package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class HarvestVO {

    private Long id;

    private String harvestCode;

    private Long farmId;

    private String farmCode;

    private String farmName;

    private Long plotId;

    private String plotCode;

    private String plotName;

    private String cropName;

    private LocalDate harvestDate;

    private BigDecimal expectedQuantity;

    private BigDecimal actualQuantity;

    private String unit;

    private String qualityGrade;

    private String storageLocation;

    private String harvestMethod;

    private String harvestTeam;

    private String supervisor;

    private String weatherCondition;

    private String photos;

    private String notes;

    private String status;

    private String traceCode;

    private String batchNumber;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}