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

    /**
     * 当前作物：作物主数据主键（页面作物下拉的 value）。

     *
     * <p>类型是 String 而不是 Long —— 页面 / 脚本下发的可能是主键、也可能是作物名，
     * 服务层按"能不能解析成数字"分流（与种养计划的作物字段同一口径）。</p>
     */
    private String cropId;

    private java.time.LocalDate plantingDate;

    private java.time.LocalDate expectedHarvestDate;

    private String remark;
}
