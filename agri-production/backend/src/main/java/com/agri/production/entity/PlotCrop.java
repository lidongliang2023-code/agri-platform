package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 地块种养品种台账（一个地块可登记多个品种）。
 *
 * <p>此前地块只有 {@code current_crop / crop_id / crop_variety} 一组单值字段，只能表达"一块地一个品种"。
 * 页面「地块详情 → 添加种养品种」要求同一地块登记多个品种（种类、品种、种植标准、种植方式、作业方式、
 * 移栽时间、预计采收、预计亩产、株数、株间距），故单独建台账。
 * 地块上的旧字段保留：列表 / 计划仍按"当前作物"显示，台账只负责多品种明细。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_plot_crop")
public class PlotCrop extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属地块主键（agri_prod_plot_info.id） */
    @TableField("plot_id")
    private Long plotId;

    /** 作物主数据主键（agri_prod_crop_info.id） */
    @TableField("crop_id")
    private Long cropId;

    /** 作物名称（种类，冗余展示） */
    @TableField("crop_name")
    private String cropName;

    /** 品种（如 中杂9号 / 普罗旺斯；编辑时清空也要真的清掉，故用 IGNORED） */
    @TableField(value = "crop_variety", updateStrategy = FieldStrategy.IGNORED)
    private String cropVariety;

    /** 种植标准：ORGANIC 有机 / GREEN 绿色 / NORMAL 普通 */
    @TableField("planting_standard")
    private String plantingStandard;

    /** 种植方式：TRANSPLANT 移栽 / DIRECT 直播 */
    @TableField("planting_method")
    private String plantingMethod;

    /** 作业方式：MANUAL 人工 / MECHANICAL 机械 */
    @TableField("operation_method")
    private String operationMethod;

    /** 移栽时间 */
    @TableField("transplant_date")
    private LocalDate transplantDate;

    /**
     * 预计采收时间。
     *
     * <p>可选字段用 {@code IGNORED}：页面编辑时清空日期要真的清掉，
     * 默认的 NOT_NULL 策略会把 null 跳过、旧值静默保留。</p>
     */
    @TableField(value = "expected_harvest_date", updateStrategy = FieldStrategy.IGNORED)
    private LocalDate expectedHarvestDate;

    /** 预计亩产（公斤/亩） */
    @TableField(value = "expected_yield_per_mu", updateStrategy = FieldStrategy.IGNORED)
    private BigDecimal expectedYieldPerMu;

    /** 株数 */
    @TableField(value = "plant_count", updateStrategy = FieldStrategy.IGNORED)
    private Integer plantCount;

    /** 株间距（cm） */
    @TableField(value = "plant_spacing", updateStrategy = FieldStrategy.IGNORED)
    private BigDecimal plantSpacing;
}
