package com.agri.production.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 种养计划新增 / 编辑入参。
 *
 * <p><b>为什么 ID 类字段是 String 而不是 Long</b>：前端契约里 {@code Plan.farmId / plotId / cropId}
 * 都是字符串，而且「新增种养计划」表单把 **作物 / 地块 / 负责人三个框做成了自由文本**
 * （PlanList 的 ProFormText：作物占位符写的是"如：tomato / 番茄"）。
 * 直接用实体接 {@code @RequestBody} 时，用户填"水稻"就会撞上 Long 反序列化 ——
 * 表现是新建计划必然 400/500，而列表页一切正常，光点页面看不出原因。
 * 这里统一按字符串收，再按"能不能解析成数字"分流：数字进 ID 列，文字进对应的 name 列。</p>
 *
 * <p>字段名取前端实际下发的名字（{@code api/production-view.ts} 的 createPlanInfo/updatePlanInfo），
 * 同义别名一并接受（expectedYield/expectedOutput、planArea/totalArea、ownerId/managerId），
 * 免得换个调用方就少写一个字段。</p>
 */
@Data
public class PlantingPlanSaveDTO {

    private String planCode;
    private String planName;

    private String farmId;
    private String farmName;

    private String plotId;
    private String plotName;

    /** 作物：可能是作物 ID，也可能是用户直接写的作物名 */
    private String cropId;
    private String cropName;
    private String cropVariety;

    /** 计划开始/结束日期（yyyy-MM-dd，也容忍 yyyy-MM-dd HH:mm:ss） */
    private String planStartDate;
    private String planEndDate;
    /** 与 planStartDate/planEndDate 同义的别名 */
    private String startDate;
    private String endDate;

    /** 预计产量（前端 expectedYield） */
    private BigDecimal expectedYield;
    /** 预计产量别名（实体侧命名） */
    private BigDecimal expectedOutput;

    /** 计划面积（亩，前端 planArea） */
    private BigDecimal planArea;
    /** 计划面积别名（实体侧命名） */
    private BigDecimal totalArea;

    private BigDecimal totalBudget;
    private BigDecimal expectedProfit;

    private Integer planYear;
    private String planSeason;
    private String planSummary;

    /** 负责人：可能是成员 ID，也可能是用户直接写的姓名（前端 ownerId） */
    private String ownerId;
    private String managerId;
    private String managerName;

    private String sopTemplateId;

    /** 前端契约码值：1 编制中 2 进行中 3 已完结 4 已取消 5 待审批 */
    private Integer status;
    /** 库里的词表值（draft/pending/active/completed/terminated），与 status 二者给一个即可 */
    private String planStatus;

    private String remark;
}
