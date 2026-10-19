package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_plot_info")
public class Plot extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("plot_code")
    private String plotCode;

    /**
     * 平台侧地块标识（{@code prod_plot_info.plot_id}，形如 DEMO-PLOT-001）。

     *
     * <p>与农场的 platformFarmId 同法：页面/历史数据里出现的是平台侧标识，而本服务的地块主键是数字 id，
     * 靠这一列换算（见 PlotIdResolver）。列由 schema-patch-plot-soil-demo.sql 的守卫式 ALTER 补齐。</p>
     */
    @TableField("platform_plot_id")
    private String platformPlotId;

    @TableField("plot_name")
    private String plotName;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_code")
    private String farmCode;

    /** 作物品种（页面 cropVariety；列由 schema-patch-plot-variety.sql 的守卫式 ALTER 补上并从平台侧回填）。 */
    @TableField("crop_variety")
    private String cropVariety;

    /** 灌溉方式（页面 irrigationType）。列 irrigation_type 一直在表里，本轮补进实体才透得到出参。 */
    @TableField("irrigation_type")
    private String irrigationType;

    /** 种植类型：1 露天 2 大棚 3 水田 4 山地（页面 plantingType；存量行可能为 NULL） */
    @TableField("planting_type")
    private Integer plantingType;

    @TableField("area")
    private BigDecimal area;

    @TableField("shape")
    private String shape;

    @TableField("boundary")
    private String boundary;

    @TableField("center_longitude")
    private BigDecimal centerLongitude;

    @TableField("center_latitude")
    private BigDecimal centerLatitude;

    @TableField("soil_type")
    private String soilType;

    @TableField("soil_ph")
    private BigDecimal soilPh;

    @TableField("soil_organic_matter")
    private BigDecimal soilOrganicMatter;

    @TableField("current_crop")
    private String currentCrop;

    /**
     * 当前作物的**主数据主键**（{@code agri_prod_crop_info.id}）。

     *
     * <p>与 {@code current_crop}（作物名，展示用）成对写入：名称给页面直接显示，
     * ID 给"按作物统计 / 关联"用。列由 {@code schema-patch-plot-crop.sql} 的守卫式 ALTER 补齐。</p>
     */
    @TableField("crop_id")
    private Long cropId;

    @TableField("planting_date")
    private java.time.LocalDate plantingDate;

    @TableField("expected_harvest_date")
    private java.time.LocalDate expectedHarvestDate;

    @TableField("status")
    private String status;

    @TableField("remark")
    private String remark;
}
