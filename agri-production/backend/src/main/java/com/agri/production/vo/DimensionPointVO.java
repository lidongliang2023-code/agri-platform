package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 多维度分析数据点（页面 DimensionPoint）。
 *
 * <p>字段按页面契约：name / yieldQty / areaMu / inputCost / outputValue / taskCount / doneCount。</p>
 *
 * <p><b>inputCost 与 outputValue 为什么恒为空</b>：本部署没有金额数据源 —— 投入品
 * （agri_prod_input_material）没有单价列，投入品使用记录只有用量（dosage/unit），
 * 采收批次（agri_prod_harvest_batch）只有产量没有金额。计划表上确实有 total_budget 与
 * expected_output，但那是**计划预算与预期产值**，不是实际成本/产值；拿它冒充会让
 * "投入产出比"这个结论指标看起来成立、其实算的是别的东西。因此如实留空。</p>
 */
@Data
public class DimensionPointVO {

    /** 维度名称（作物名 / 地块名 / 月份） */
    private String name;

    /** 产量（kg） */
    private BigDecimal yieldQty;

    /** 面积（亩） */
    private BigDecimal areaMu;

    /** 投入成本（元）—— 无数据源，恒为 null */
    private BigDecimal inputCost;

    /** 产值（元）—— 无数据源，恒为 null */
    private BigDecimal outputValue;

    /** 任务总数 */
    private long taskCount;

    /** 已完成任务数 */
    private long doneCount;
}
