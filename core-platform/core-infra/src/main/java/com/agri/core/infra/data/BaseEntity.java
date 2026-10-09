package com.agri.core.infra.data;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 实体基类：雪花主键 + market_id（ADR-005 Day 1 内建）+ tenant_id（预留，暂不启用多租户逻辑）
 * + 审计时间 + 逻辑删除。
 */
@Data
public abstract class BaseEntity {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 三大市场数据隔离维度，框架层自动填充与过滤 */
    @TableField(fill = FieldFill.INSERT)
    private Long marketId;

    /** 多产业带 SaaS 化预留字段（Phase 3），默认 0 */
    @TableField(fill = FieldFill.INSERT)
    private Long tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    @TableField(select = false)
    private Integer deleted;
}
