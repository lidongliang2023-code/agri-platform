package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("agri_prod_task_template")
public class TaskTemplate {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("template_code")
    private String templateCode;

    @TableField("template_name")
    private String templateName;

    @TableField("template_type")
    private String templateType;

    @TableField("crop_category")
    private String cropCategory;

    @TableField("crop_name")
    private String cropName;

    @TableField("task_type")
    private String taskType;

    @TableField("growth_stage")
    private String growthStage;

    @TableField("description")
    private String description;

    @TableField("template_content")
    private String templateContent;

    @TableField("recommended_duration_hours")
    private Integer recommendedDurationHours;

    @TableField("required_inputs")
    private String requiredInputs;

    @TableField("optional_inputs")
    private String optionalInputs;

    @TableField("is_system")
    private Integer isSystem;

    @TableField("use_count")
    private Integer useCount;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("status")
    private String status;

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