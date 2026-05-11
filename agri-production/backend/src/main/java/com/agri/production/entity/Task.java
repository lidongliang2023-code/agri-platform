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
@TableName("agri_prod_task_info")
public class Task extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("task_code")
    private String taskCode;

    @TableField("task_name")
    private String taskName;

    @TableField("task_type")
    private String taskType;

    @TableField("task_type_detail")
    private String taskTypeDetail;

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

    @TableField("task_desc")
    private String taskDesc;

    @TableField("executor_id")
    private Long executorId;

    @TableField("executor_name")
    private String executorName;

    @TableField("plan_start_time")
    private java.time.LocalDateTime planStartTime;

    @TableField("plan_end_time")
    private java.time.LocalDateTime planEndTime;

    @TableField("actual_start_time")
    private java.time.LocalDateTime actualStartTime;

    @TableField("actual_end_time")
    private java.time.LocalDateTime actualEndTime;

    @TableField("status")
    private String status;

    @TableField("priority")
    private String priority;

    @TableField("input_materials")
    private String inputMaterials;

    @TableField("input_materials_json")
    private String inputMaterialsJson;

    @TableField("expected_output")
    private BigDecimal expectedOutput;

    @TableField("actual_output")
    private BigDecimal actualOutput;

    @TableField("quality_requirement")
    private String qualityRequirement;

    @TableField("result_photo_urls")
    private String resultPhotoUrls;

    @TableField("result_desc")
    private String resultDesc;

    @TableField("approval_status")
    private String approvalStatus;

    @TableField("approval_comment")
    private String approvalComment;

    @TableField("template_id")
    private Long templateId;

    @TableField("remark")
    private String remark;
}