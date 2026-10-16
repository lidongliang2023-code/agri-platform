package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 地块土壤检测档案（页面「地块详情 → 土壤检测」，{@code agri_prod_soil_record}）。
 *
 * <p>这张表早先建过但一直没人用（0 行、没有任何实体映射）。本轮把列口径对齐到页面：
 * 补 soil_id（业务主键）、farm_id、tester、test_org、conductivity、conclusion、report_url；
 * 页面要的 {@code ph/organicMatter/totalNitrogen/availablePhosphorus/availablePotassium/moisture}
 * 在本表里分别是 ph_value/organic_matter/nitrogen/phosphorus/potassium/moisture_content —— 列名保持不动，
 * 由出参 VO 换成页面契约名（改列名会牵动这张表所有历史查询）。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_soil_record")
public class SoilRecord extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 档案编号（业务主键，页面 recordId） */
    @TableField("soil_id")
    private String soilId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("sample_date")
    private LocalDate sampleDate;

    @TableField("ph_value")
    private BigDecimal phValue;

    @TableField("organic_matter")
    private BigDecimal organicMatter;

    @TableField("nitrogen")
    private BigDecimal nitrogen;

    @TableField("phosphorus")
    private BigDecimal phosphorus;

    @TableField("potassium")
    private BigDecimal potassium;

    @TableField("moisture_content")
    private BigDecimal moistureContent;

    @TableField("temperature")
    private BigDecimal temperature;

    @TableField("recommendations")
    private String recommendations;

    /** 检测人（页面 tester） */
    @TableField("tester")
    private String tester;

    /** 检测机构（页面 testOrg；本部署无数据源，可空） */
    @TableField("test_org")
    private String testOrg;

    /** 电导率（页面 conductivity；平台侧只有含盐量，两者不混用） */
    @TableField("conductivity")
    private BigDecimal conductivity;

    @TableField("conclusion")
    private String conclusion;

    @TableField("report_url")
    private String reportUrl;

    @TableField("remark")
    private String remark;
}
