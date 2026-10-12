package com.agri.admin.vo;

import lombok.Data;

import java.util.List;

/** 质量检测任务（运营端「数据质量 → 检测任务」）。 */
@Data
public class QualityTaskVO {

    private Long id;
    private String taskCode;
    private String taskName;
    private String taskType;
    private String cronExpression;
    private String status;
    private String lastRunTime;
    private String nextRunTime;
    private Integer lastSuccessCount;
    private Integer lastFailCount;
    private Double successRate;
    private Integer runCount;
    private String createTime;

    /** 关联规则（列表页要显示规则名，故选规则时一并带出来） */
    private List<Long> ruleIds;
    private List<String> ruleNames;
}
