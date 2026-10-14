package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 种养计划阶段（生育期，农事日历的节点）。
 *
 * <p>前端「种养计划详情」页读它：{@code GET /plans/{planId}/stages/list}，
 * 并可增删改（{@code POST/PUT/DELETE /plans/{planId}/stages[/{stageId}]}）。
 * 前端这个页面此前完全没有后端支撑 —— 表、实体、接口三样都缺，
 * 一进详情页阶段列表就是空的（且新增阶段必然失败）。</p>
 *
 * <p>字段名**直接按前端契约命名**（{@code @agri/shared/types/plan} 的 {@code PlanStage}），
 * 物理列用 {@code @TableField} 指到 snake_case —— 与 {@code TaskRecord} 同一口径：
 * 出参 Java 名即 JSON 名，少一层 VO 就少一处对不上的地方。</p>
 *
 * <p><b>刻意不继承 BaseEntity</b>：BaseEntity 固定带 tenant_id / farm_id 等列，
 * 而本表按"租户 + 计划"归属，没有 farm_id —— 继承了 MyBatis-Plus 就会在
 * SELECT/INSERT 里多带一个 farm_id，一调就是 {@code Unknown column 'farm_id'}。</p>
 */
@Data
@TableName("agri_prod_plan_stage")
public class PlanStage {

    @TableId(value = "id", type = IdType.AUTO)
    private Long stageId;

    @TableField("plan_id")
    private Long planId;

    /** 阶段序号（前端 PlanStage.stageNo 与 api 层 stageSeq 是同一个东西） */
    @TableField("stage_seq")
    private Integer stageSeq;

    @TableField("stage_name")
    private String stageName;

    /** 默认任务类型：任务链自动生成（PRD PLAN-03）时由任务继承 */
    @TableField("task_type")
    private String taskType;

    @TableField("plan_start_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate planStartDate;

    @TableField("plan_end_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate planEndDate;

    @TableField("actual_start_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate actualStartDate;

    @TableField("actual_end_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate actualEndDate;

    @TableField("description")
    private String description;

    /** 0 已取消 / 1 未开始 / 2 进行中 / 3 已完成（与前端 stageStatusMeta 同义） */
    @TableField("status")
    private Integer status;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
