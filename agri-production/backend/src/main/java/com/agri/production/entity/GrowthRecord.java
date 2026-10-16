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
 * 生长监测记录（用户端「生长记录」「生长监测总览」）。
 *
 * <p>字段与页面 {@code GrowthRecord} 契约逐项对齐（见 {@code packages/agri-shared/src/types/growth.ts}）：
 * {@code height→plantHeight}、{@code leafCount→leafCount}、{@code leafAreaIndex}、{@code growthLevel}、
 * {@code pestInfo}。表结构说明（含 plot_id 为什么是字符串标识）见 schema-mysql.sql 里本表的 DDL 注释。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_growth_record")
public class GrowthRecord extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 记录编号（业务主键，页面 recordId） */
    @TableField("record_id")
    private String recordId;

    /**
     * 地块标识（页面口径）。
     *
     * <p>刻意是字符串：本阶段页面回传的是平台侧地块标识（如 DEMO-PLOT-001），
     * 本服务尚没有 platform_plot_id 映射可用来换算成本地数字主键（详见 DDL 注释与
     * 《剩余缺口处置方案》第六节）。做成 Long 会让页面按地块筛选直接失败。</p>
     */
    @TableField("plot_id")
    private String plotId;

    @TableField("plot_name")
    private String plotName;

    @TableField("plan_id")
    private String planId;

    @TableField("crop_id")
    private String cropId;

    @TableField("crop_name")
    private String cropName;

    /** 生育期：苗期 / 开花期 / 结果期 / 采收期 */
    @TableField("growth_stage")
    private String growthStage;

    @TableField("record_date")
    private LocalDate recordDate;

    /** 株高（cm） */
    @TableField("plant_height")
    private BigDecimal plantHeight;

    @TableField("leaf_count")
    private Integer leafCount;

    /** 叶面积指数（人工录入；演示行由规则推算，不由服务端现算） */
    @TableField("leaf_area_index")
    private BigDecimal leafAreaIndex;

    /** 长势评级 1 弱 / 2 偏弱 / 3 正常 / 4 旺盛 */
    @TableField("growth_level")
    private Integer growthLevel;

    /** 病虫害等级 0 无 / 1 轻 / 2 中 / 3 重 */
    @TableField("pest_level")
    private Integer pestLevel;

    @TableField("pest_info")
    private String pestInfo;

    @TableField("weather")
    private String weather;

    /** 现场照片（JSON 数组字符串） */
    @TableField("photos")
    private String photos;

    @TableField("recorder_id")
    private String recorderId;

    @TableField("recorder_name")
    private String recorderName;

    @TableField("remark")
    private String remark;

    /** 1 有效 0 停用 */
    @TableField("status")
    private Integer status;
}
