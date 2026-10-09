package com.agri.produce.internal.plan;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

/**
 * 种养计划阶段（整地/播种/施肥…）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_plan_stage")
public class PlanStageEntity extends ProduceBaseEntity {

    @TableId(value = "stage_id", type = IdType.INPUT)
    private String stageId;

    /** 计划ID */
    private String planId;

    /** 阶段名称 */
    private String stageName;

    /** 阶段序号 */
    private Integer stageSeq;

    /** 计划开始 */
    private LocalDate planStartDate;

    /** 计划结束 */
    private LocalDate planEndDate;

    /** 默认任务类型 */
    private String taskType;

    /** 阶段说明 */
    private String description;

    /** 状态 1未开始 2进行中 3已完成 0取消 */
    private Integer status;
}
