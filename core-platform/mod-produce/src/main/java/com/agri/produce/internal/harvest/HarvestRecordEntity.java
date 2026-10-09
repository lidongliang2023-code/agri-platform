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
 * 采收作业记录（每次下地采收的原始登记）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_harvest_record")
public class HarvestRecordEntity extends ProduceBaseEntity {

    @TableId(value = "record_id", type = IdType.INPUT)
    private String recordId;

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

    /** 单位 */
    private String unit;

    /** 等级 */
    private String grade;

    /** 采收人 */
    private String operatorId;

    /** 天气 */
    private String weather;

    /** 备注 */
    private String remark;

    /** 状态 1有效 0作废 */
    private Integer status;
}
