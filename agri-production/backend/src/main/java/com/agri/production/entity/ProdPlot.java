package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_plot")
public class ProdPlot {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_code")
    private String plotCode;

    @TableField("plot_name")
    private String plotName;

    @TableField("plot_type")
    private String plotType;

    @TableField("area")
    private BigDecimal area;

    @TableField("area_unit")
    private String areaUnit;

    @TableField("location_lat")
    private BigDecimal locationLat;

    @TableField("location_lng")
    private BigDecimal locationLng;

    @TableField("location_name")
    private String locationName;

    @TableField("boundary_json")
    private String boundaryJson;

    @TableField("soil_type")
    private String soilType;

    @TableField("soil_ph")
    private BigDecimal soilPh;

    @TableField("soil_organic")
    private BigDecimal soilOrganic;

    @TableField("soil_nitrogen")
    private BigDecimal soilNitrogen;

    @TableField("soil_phosphorus")
    private BigDecimal soilPhosphorus;

    @TableField("soil_potassium")
    private BigDecimal soilPotassium;

    @TableField("water_source")
    private String waterSource;

    @TableField("irrigation_type")
    private String irrigationType;

    @TableField("drainage_type")
    private String drainageType;

    @TableField("current_crop")
    private String currentCrop;

    @TableField("crop_variety")
    private String cropVariety;

    @TableField("planting_date")
    private Date plantingDate;

    @TableField("expected_harvest_date")
    private Date expectedHarvestDate;

    @TableField("growth_stage")
    private String growthStage;

    @TableField("status")
    private String status;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;

    @TableField("remark")
    private String remark;
}