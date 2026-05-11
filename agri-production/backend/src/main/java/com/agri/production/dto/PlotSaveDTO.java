package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlotSaveDTO {

    private Long id;

    @NotBlank(message = "地块名称不能为空")
    private String plotName;

    @NotNull(message = "所属农场ID不能为空")
    private Long farmId;

    private String farmCode;

    private BigDecimal area;

    private String shape;

    private String boundary;

    private BigDecimal centerLongitude;

    private BigDecimal centerLatitude;

    private String soilType;

    private BigDecimal soilPh;

    private BigDecimal soilOrganicMatter;

    private String currentCrop;

    private java.time.LocalDate plantingDate;

    private java.time.LocalDate expectedHarvestDate;

    private String remark;
}