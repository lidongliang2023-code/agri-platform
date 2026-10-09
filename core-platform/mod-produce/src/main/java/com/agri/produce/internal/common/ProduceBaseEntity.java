package com.agri.produce.internal.common;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableLogic;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 生产域实体基类：市场/租户隔离 + 审计列 + 逻辑删除。
 *
 * <p>说明：不复用 core-infra 的 {@code BaseEntity}，原因是 PRD 11.2 约定各表采用业务主键
 * （{@code varchar(32)}，如 farm_id / plot_id / task_id），雪花 {@code id} 主键不适用于
 * 跨系统引用的业务编码；审计列命名对齐 V1 迁移脚本风格，由 MyMetaObjectHandler 自动填充。
 */
@Data
public abstract class ProduceBaseEntity {

    /** 三大市场数据隔离维度（ADR-005），MyMetaObjectHandler 自动填充 */
    @TableField(fill = FieldFill.INSERT)
    private Long marketId;

    /** 多产业带 SaaS 租户，默认 0 */
    @TableField(fill = FieldFill.INSERT)
    private Long tenantId;

    @TableField("create_by")
    private Long createBy;

    @TableField("update_by")
    private Long updateBy;

    /** 创建时间（列 create_at，PRD 11.2 命名） */
    @TableField(value = "create_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    /** 更新时间（列 update_at，PRD 11.2 命名） */
    @TableField(value = "update_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    /** 逻辑删除（全局 logic-delete-field 约定为 deleted，与 V1 迁移脚本一致） */
    @TableLogic
    @TableField(select = false)
    private Integer deleted;
}
