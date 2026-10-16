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

    /**
     * 灌溉方式（如 滴灌 / 喷灌 / 漫灌）。
     *
     * <p>2026-10-17 补：表 {@code agri_prod_plot_info.irrigation_type} 与实体 {@code Plot} 都有这一列，
     * PC 端新增地块表单也一直在提交它，但 DTO 里缺这一项 —— 意味着**选了也不落库**（静默丢弃）。
     * 移动端「新增地块」的 Step1 要编辑这一项，故补上；服务层是 {@code BeanCopyUtils.copy(dto, plot)}，
     * 字段同名即自动映射。</p>
     */
    private String irrigationType;

    /**
     * 作物品种（如 中杂9号）。
     *
     * <p>2026-10-17 补：同上，列与实体都有、页面要显示与录入，DTO 缺失就写不进去。</p>
     */
    private String cropVariety;

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
