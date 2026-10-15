package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 作业标准（SOP）执行记录。
 *
 * <p><b>五处 @TableField 指向的是已有旧列（2026-10-15 对齐）：</b>
 * executor→executor_name、startedAt→start_time、completedAt→end_time、
 * stepRecords→execution_log、notes→remark。都是同一代脚手架里语义相同、名字不同的列，
 * 改成映射已有列而不是新增 5 个重复列（列名只影响 SQL，接口出参字段名由实体字段名决定）。</p>
 *
 * <p>真正没有对应物的列（template_code / task_id / total_steps / actual_duration /
 * attachments）由 schema-patch-sop-page.sql 补上。</p>
 */
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

    @TableField("executor_name")
    private String executor;

    @TableField("status")
    private String status;

    @TableField("current_step")
    private Integer currentStep;

    @TableField("total_steps")
    private Integer totalSteps;

    @TableField("start_time")
    private java.time.LocalDateTime startedAt;

    @TableField("end_time")
    private java.time.LocalDateTime completedAt;

    @TableField("actual_duration")
    private Integer actualDuration;

    @TableField("execution_log")
    private String stepRecords;

    @TableField("remark")
    private String notes;

    @TableField("attachments")
    private String attachments;
}
