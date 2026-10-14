package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.Date;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_planting_plan")
public class PlantingPlan extends BaseEntity {

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

    /**
     * 前端「生产计划」页契约要、而实体原先没有的字段。
     *
     * <p>契约（@agri/shared/types/plan 的 Plan）读的是 plotName / cropId / cropName /
     * cropVariety / managerId / managerName / sopTemplateId / farmName —— 缺一个页面上就是空列。
     * 其中 plotName / farmName 是冗余展示字段（写入时按 plotId / farmId 补全）。</p>
     */
    @TableField("plot_name")
    private String plotName;

    /**
     * 地块 ID。
     *
     * <p>表里一直有 {@code plot_id}，实体却漏了它 —— 后果不是"少显示一列"：
     * 前端计划列表/详情（{@code Plan.plotId}）、按地块查在种计划的冲突校验
     * （PRD R-PLAN-01）、农事日历的地块归属**同时拿不到值**。补上之后这些逻辑才有输入。</p>
     */
    @TableField("plot_id")
    private Long plotId;

    @TableField("farm_name")
    private String farmName;
    @TableField("crop_id")
    private Long cropId;
    @TableField("crop_name")
    private String cropName;
    @TableField("crop_variety")
    private String cropVariety;
    @TableField("manager_id")
    private Long managerId;
    @TableField("manager_name")
    private String managerName;
    @TableField("sop_template_id")
    private Long sopTemplateId;

    @TableField("approval_comment")
    private String approvalComment;

    @TableField("approver")
    private String approver;

    @TableField("approval_time")
    private Date approvalTime;

    @TableField("remark")
    private String remark;
}
