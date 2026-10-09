package com.agri.produce.internal.task;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

/**
 * 农事任务模板（按作物/阶段预置）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_task_template")
public class TaskTemplateEntity extends ProduceBaseEntity {

    @TableId(value = "template_id", type = IdType.INPUT)
    private String templateId;

    /** 作物ID */
    private String cropId;

    /** 模板名称 */
    private String templateName;

    /** 任务类型 */
    private String taskType;

    /** 适用阶段序号 */
    private Integer stageSeq;

    /** 距上一阶段间隔天数 */
    private Integer intervalDays;

    /** 标准工时 */
    private BigDecimal workHours;

    /** 作业内容 */
    private String workContent;

    /** 建议投入品ID（JSON 数组） */
    private String inputIds;

    /** 状态 1启用 0停用 */
    private Integer status;
}
