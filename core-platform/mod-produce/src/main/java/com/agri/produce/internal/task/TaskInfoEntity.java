package com.agri.produce.internal.task;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 农事任务（派发/执行/验收闭环）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_task_info")
public class TaskInfoEntity extends ProduceBaseEntity {

    @TableId(value = "task_id", type = IdType.INPUT)
    private String taskId;

    /** 任务单号（租户内唯一） */
    private String taskNo;

    /** 计划ID */
    private String planId;

    /** 地块ID */
    private String plotId;

    /** 任务类型 整地/播种/施肥/打药/灌溉/采收 */
    private String taskType;

    /** 任务名称 */
    private String taskName;

    /** 计划开始 */
    private LocalDate planStartDate;

    /** 计划结束 */
    private LocalDate planEndDate;

    /** 执行人 */
    private String assigneeId;

    /** 派发人 */
    private String assignerId;

    /** 状态 pending/assigned/doing/done/rejected */
    private String status;

    /** 优先级 1高 2中 3低 */
    private Integer priority;

    /** 来源模板ID */
    private String templateId;

    /** 关联投入品使用ID（JSON 数组） */
    private String relatedUsageIds;

    /** 驳回次数 */
    private Integer rejectCount;

    /** 验收 0待验收 1通过 2驳回 */
    private Integer acceptStatus;

    /** 完成时间 */
    private LocalDateTime completedAt;
}
