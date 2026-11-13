package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlotSaveDTO {

    private Long id;

    @NotBlank(message = "地块名称不能为空")
    @Size(max = 30, message = "地块名称不超过30个字符")
    private String plotName;

    @NotNull(message = "所属农场ID不能为空")
    @Min(value = 1, message = "所属农场ID不合法")
    private Long farmId;

    private String farmCode;

    @NotNull(message = "地块面积不能为空")
    @DecimalMin(value = "0", inclusive = false, message = "地块面积必须大于0")
    @Digits(integer = 8, fraction = 2, message = "地块面积最多8位整数、2位小数")
    private BigDecimal area;

    private String shape;

    private String boundary;

    @DecimalMin(value = "-180", message = "经度应在-180到180之间")
    @DecimalMax(value = "180", message = "经度应在-180到180之间")
    private BigDecimal centerLongitude;

    @DecimalMin(value = "-90", message = "纬度应在-90到90之间")
    @DecimalMax(value = "90", message = "纬度应在-90到90之间")
    private BigDecimal centerLatitude;

    @JsonIgnore
    @AssertTrue(message = "中心经纬度必须同时填写或同时清空")
    public boolean isCenterPairValid() {
        return (centerLongitude == null) == (centerLatitude == null);
    }

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
     * 种植类型：1 露天 2 大棚 3 水田 4 山地。
     *
     * <p>2026-10-19 补列（{@code schema-patch-plot-planting-type.sql}）：此前表里没有这一列，
     * 表单提交了也被丢弃、列表用默认值 1 把整片农场都说成「露天」。现在落真实列，
     * 存量行保持 NULL（不猜），页面显示「—」。</p>
     */
    @Min(value = 1, message = "种植类型不合法")
    @Max(value = 4, message = "种植类型不合法")
    private Integer plantingType;

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
