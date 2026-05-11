package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_sop_execution")
public class SopExecution extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("execution_code")
    private String executionCode;

    @TableField("template_id")
    private Long templateId;

    @TableField("template_code")
    private String templateCode;

    @TableField("template_name")
    private String templateName;

    @TableField("task_id")
    private Long taskId;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("executor")
    private String executor;

    @TableField("status")
    private String status;

    @TableField("current_step")
    private Integer currentStep;

    @TableField("total_steps")
    private Integer totalSteps;

    @TableField("started_at")
    private java.time.LocalDateTime startedAt;

    @TableField("completed_at")
    private java.time.LocalDateTime completedAt;

    @TableField("actual_duration")
    private Integer actualDuration;

    @TableField("step_records")
    private String stepRecords;

    @TableField("notes")
    private String notes;

    @TableField("attachments")
    private String attachments;
}