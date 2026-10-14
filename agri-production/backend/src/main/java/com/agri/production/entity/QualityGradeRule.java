package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 质量分级规则。
 *
 * <p>字段名按前端契约（{@code @agri/shared/types/quality} 的 {@code QualityGradeRule}）：
 * gradeCode A/B/C/D、metrics 分级指标、criteria 判定标准、priceFactor 价格系数、
 * status 1 启用 / 0 停用。</p>
 *
 * <p>为什么这一张表也得建：{@code POST /quality/grading} 与 {@code PUT/DELETE /quality/grading/{id}}
 * 在 core-platform 上是**已实现**的，切流到 agri-production 之后这两个路径会变成 405
 * （路径在、方法不在，回退只认 404 接不住）—— 也就是切流把两个原本能用的端点做坏了。
 * 实现在这里把它补回来。</p>
 */
@Data
@TableName("agri_prod_quality_grade_rule")
public class QualityGradeRule {

    @TableId(value = "id", type = IdType.AUTO)
    private Long ruleId;

    /** A / B / C / D */
    @TableField("grade_code")
    private String gradeCode;

    @TableField("grade_name")
    private String gradeName;

    @TableField("crop_id")
    private Long cropId;

    @TableField("crop_name")
    private String cropName;

    /** 分级指标，如 单果重 / 糖度 / 外观 */
    @TableField("metrics")
    private String metrics;

    /** 判定标准描述 */
    @TableField("criteria")
    private String criteria;

    /** 价格系数 */
    @TableField("price_factor")
    private BigDecimal priceFactor;

    /** 1 启用 / 0 停用 */
    @TableField("status")
    private Integer status;

    @TableField("remark")
    private String remark;

    @TableField("tenant_id")
    private String tenantId;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;
}
