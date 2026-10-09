package com.agri.produce.internal.plan;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 种养计划（作物/品种/周期/预期产量）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_plan_info")
public class PlanInfoEntity extends ProduceBaseEntity {

    @TableId(value = "plan_id", type = IdType.INPUT)
    private String planId;

    /** 农场ID */
    private String farmId;

    /** 地块ID */
    private String plotId;

    /** 计划编码（租户内唯一） */
    private String planCode;

    /** 计划名称 */
    private String planName;

    /** 作物ID */
    private String cropId;

    /** 品种 */
    private String cropVariety;

    /** 计划开始 */
    private LocalDate planStartDate;

    /** 计划结束 */
    private LocalDate planEndDate;

    /** 预期产量 */
    private BigDecimal expectedYield;

    /** 预期产值（元） */
    private BigDecimal expectedAmount;

    /** 负责人 */
    private String ownerId;

    /** 状态 1草稿 2进行中 3已完成 4已终止 0作废 */
    private Integer status;
}
