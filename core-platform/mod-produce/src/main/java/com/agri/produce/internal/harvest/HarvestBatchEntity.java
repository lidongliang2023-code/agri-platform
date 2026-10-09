package com.agri.produce.internal.harvest;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 采收批次（溯源主链：地块 → 采收 → 检测 → 批次 → 溯源码）。
 *
 * <p><b>权威表。</b>对应 prod_harvest_batch（PRD 11.2.5），是批次体系的终态口径。
 * 新生产链路（采收登记、批次生成、溯源激活、等级定价、库存出入库、召回）
 * 一律以此表为准。</p>
 *
 * <p>V1 的 {@code prod_batch}（旧「农事批次」，雪花 Long 主键）仅作存量链路兼容，
 * 不再承接新业务；两者主键类型不同：本表 batchId 为 varchar(32) 字符串，
 * prod_batch.id 为雪花 Long 数字，跨表串联时不要混用。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_harvest_batch")
public class HarvestBatchEntity extends ProduceBaseEntity {

    @TableId(value = "batch_id", type = IdType.INPUT)
    private String batchId;

    /** 批次号（全局唯一） */
    private String batchNo;

    /** 地块ID */
    private String plotId;

    /** 计划ID */
    private String planId;

    /** 作物ID */
    private String cropId;

    /** 品种 */
    private String cropVariety;

    /** 采收日期 */
    private LocalDate harvestDate;

    /** 采收数量 */
    private BigDecimal quantity;

    /** 单位，默认 kg */
    private String unit;

    /** 等级，默认 待检 */
    private String grade;

    /** 检测报告ID */
    private String inspectionId;

    /** 采收人 */
    private String operatorId;

    /** 状态 1在库 2部分出库 3清空 4冻结 5归档 */
    private Integer status;
}
