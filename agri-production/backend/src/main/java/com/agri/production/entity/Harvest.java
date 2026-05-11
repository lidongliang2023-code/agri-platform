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
@TableName("agri_prod_harvest_record")
public class Harvest extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("harvest_code")
    private String harvestCode;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_code")
    private String farmCode;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_code")
    private String plotCode;

    @TableField("crop_name")
    private String cropName;

    @TableField("harvest_date")
    private java.time.LocalDate harvestDate;

    @TableField("expected_quantity")
    private BigDecimal expectedQuantity;

    @TableField("actual_quantity")
    private BigDecimal actualQuantity;

    @TableField("unit")
    private String unit;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("storage_location")
    private String storageLocation;

    @TableField("harvest_method")
    private String harvestMethod;

    @TableField("harvest_team")
    private String harvestTeam;

    @TableField("supervisor")
    private String supervisor;

    @TableField("weather_condition")
    private String weatherCondition;

    @TableField("photos")
    private String photos;

    @TableField("notes")
    private String notes;

    @TableField("status")
    private String status;

    @TableField("trace_code")
    private String traceCode;

    @TableField("batch_number")
    private String batchNumber;
}