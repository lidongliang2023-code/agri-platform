package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** AI 诊断记录（页面「病虫害识别」列表）。本服务不产生诊断结论，只承载已有记录。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_ai_diagnosis")
public class AiDiagnosis extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("diagnosis_id")
    private String diagnosisId;

    @TableField("plot_id")
    private String plotId;

    @TableField("crop_id")
    private String cropId;

    @TableField("crop_name")
    private String cropName;

    @TableField("image_url")
    private String imageUrl;

    /** PEST / GROWTH / MATURITY */
    @TableField("diagnosis_type")
    private String diagnosisType;

    @TableField("result_label")
    private String resultLabel;

    /** 置信度（%） */
    @TableField("confidence")
    private BigDecimal confidence;

    @TableField("suggestion")
    private String suggestion;

    @TableField("model_name")
    private String modelName;

    @TableField("status")
    private String status;

    @TableField("diagnosed_at")
    private LocalDateTime diagnosedAt;
}
