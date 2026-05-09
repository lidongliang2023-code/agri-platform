package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_task")
public class Task {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("task_code")
    private String taskCode;

    @TableField("task_name")
    private String taskName;

    @TableField("farm_id")
    private Long farmId;

    @TableField("task_type")
    private String taskType;

    @TableField("task_source")
    private String taskSource;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_ids")
    private String plotIds;

    @TableField("plan_id")
    private Long planId;

    @TableField("template_id")
    private Long templateId;

    @TableField("plan_date")
    private Date planDate;

    @TableField("plan_executor")
    private String planExecutor;

    @TableField("actual_executor")
    private String actualExecutor;

    @TableField("priority")
    private String priority;

    @TableField("status")
    private String status;

    @TableField("completion_rate")
    private BigDecimal completionRate;

    @TableField("plan_start_time")
    private Date planStartTime;

    @TableField("plan_end_time")
    private Date planEndTime;

    @TableField("actual_start_time")
    private Date actualStartTime;

    @TableField("actual_end_time")
    private Date actualEndTime;

    @TableField("task_desc")
    private String taskDesc;

    @TableField("inputs_json")
    private String inputsJson;

    @TableField("expected_output")
    private String expectedOutput;

    @TableField("related_task_id")
    private Long relatedTaskId;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

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