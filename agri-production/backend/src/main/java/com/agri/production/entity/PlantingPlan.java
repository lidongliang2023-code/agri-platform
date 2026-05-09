package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_planting_plan")
public class PlantingPlan {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("plan_code")
    private String planCode;

    @TableField("plan_name")
    private String planName;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plan_year")
    private Integer planYear;

    @TableField("plan_season")
    private String planSeason;

    @TableField("plan_status")
    private String planStatus;

    @TableField("total_area")
    private BigDecimal totalArea;

    @TableField("total_budget")
    private BigDecimal totalBudget;

    @TableField("expected_output")
    private BigDecimal expectedOutput;

    @TableField("expected_profit")
    private BigDecimal expectedProfit;

    @TableField("start_date")
    private Date startDate;

    @TableField("end_date")
    private Date endDate;

    @TableField("plan_summary")
    private String planSummary;

    @TableField("approval_comment")
    private String approvalComment;

    @TableField("approver")
    private String approver;

    @TableField("approval_time")
    private Date approvalTime;

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