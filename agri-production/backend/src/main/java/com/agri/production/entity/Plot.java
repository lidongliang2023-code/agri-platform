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

    @TableField("plot_name")
    private String plotName;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_code")
    private String farmCode;

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

    @TableField("planting_date")
    private java.time.LocalDate plantingDate;

    @TableField("expected_harvest_date")
    private java.time.LocalDate expectedHarvestDate;

    @TableField("status")
    private String status;

    @TableField("remark")
    private String remark;
}