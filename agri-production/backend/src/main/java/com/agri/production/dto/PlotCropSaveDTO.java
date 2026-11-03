package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 地块种养品种新增 / 编辑入参（字段对齐「添加种养品种」弹窗）。
 */
@Data
public class PlotCropSaveDTO {

    /**
     * 种类：作物主数据主键（页面下拉的 value）。
     *
     * <p>类型是 String 而不是 Long —— 与地块 / 计划同一口径，同时容忍调用方下发作物名，
     * 服务层按"能不能解析成数字"分流。</p>
     */
    @NotBlank(message = "种类不能为空")
    private String cropId;

    /** 品种（如 中杂9号 / 普罗旺斯） */
    private String cropVariety;

    /** 种植标准：ORGANIC 有机 / GREEN 绿色 / NORMAL 普通 */
    @NotBlank(message = "种植标准不能为空")
    private String plantingStandard;

    /** 种植方式：TRANSPLANT 移栽 / DIRECT 直播 */
    @NotBlank(message = "种植方式不能为空")
    private String plantingMethod;

    /** 作业方式：MANUAL 人工 / MECHANICAL 机械 */
    @NotBlank(message = "作业方式不能为空")
    private String operationMethod;

    /** 移栽时间（yyyy-MM-dd） */
    @NotNull(message = "移栽时间不能为空")
    private LocalDate transplantDate;

    /** 预计采收时间（yyyy-MM-dd，可选） */
    private LocalDate expectedHarvestDate;

    /** 预计亩产（公斤/亩） */
    private BigDecimal expectedYieldPerMu;

    /** 株数 */
    private Integer plantCount;

    /** 株间距（cm） */
    private BigDecimal plantSpacing;
}
