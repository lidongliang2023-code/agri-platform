package com.agri.produce.internal.batch;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 农事批次（溯源主链：地块 → 农事 → 检测 → 采收批次 → 溯源码）。
 *
 * <p><b>遗留表，存量兼容保留。</b>对应 V1__init_core.sql 的 prod_batch，是旧的「农事批次」概念，
 * 主键为雪花 Long。
 *
 * <p>架构侧已裁决：<b>批次体系的终态口径是 prod_harvest_batch（PRD 11.2.5 采收批次），
 * 它是采收批次的权威表</b>。新生产链路（采收登记、批次生成、溯源激活、等级定价）
 * 一律使用 prod_harvest_batch，不要在本实体上扩展。本表仅保留供存量链路兼容，
 * 后续如需统一由专项迁移处理，本轮不迁移、不 DROP。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_batch")
public class BatchEntity extends BaseEntity {

    private String batchCode;
    private Long plotId;
    private Long productId;
    private BigDecimal quantity;
    /** GROWING=种植中 HARVESTED=已采收 CLOSED=已结批 */
    private String status;
    private LocalDateTime harvestAt;
}
