package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class HarvestSaveDTO {

    private Long id;

    @NotNull(message = "农场ID不能为空")
    private Long farmId;

    private String farmCode;

    private Long plotId;

    private String plotCode;

    @NotBlank(message = "作物名称不能为空")
    private String cropName;

    private java.time.LocalDate harvestDate;

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

    private String batchNumber;
}