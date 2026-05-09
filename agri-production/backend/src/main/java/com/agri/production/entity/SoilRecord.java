package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_soil_record")
public class SoilRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("plot_id")
    private Long plotId;

    @TableField("record_no")
    private String recordNo;

    @TableField("sample_no")
    private String sampleNo;

    @TableField("sample_date")
    private Date sampleDate;

    @TableField("sample_location")
    private String sampleLocation;

    @TableField("lab_name")
    private String labName;

    @TableField("test_date")
    private Date testDate;

    @TableField("ph")
    private BigDecimal ph;

    @TableField("organic_matter")
    private BigDecimal organicMatter;

    @TableField("total_nitrogen")
    private BigDecimal totalNitrogen;

    @TableField("available_phosphorus")
    private BigDecimal availablePhosphorus;

    @TableField("available_potassium")
    private BigDecimal availablePotassium;

    @TableField("hydrolyzable_nitrogen")
    private BigDecimal hydrolyzableNitrogen;

    @TableField("moisture")
    private BigDecimal moisture;

    @TableField("heavy_metal_lead")
    private BigDecimal heavyMetalLead;

    @TableField("heavy_metal_cadmium")
    private BigDecimal heavyMetalCadmium;

    @TableField("heavy_metal_mercury")
    private BigDecimal heavyMetalMercury;

    @TableField("heavy_metal_arsenic")
    private BigDecimal heavyMetalArsenic;

    @TableField("health_score")
    private BigDecimal healthScore;

    @TableField("health_level")
    private String healthLevel;

    @TableField("improvement_suggestion")
    private String improvementSuggestion;

    @TableField("report_url")
    private String reportUrl;

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
}