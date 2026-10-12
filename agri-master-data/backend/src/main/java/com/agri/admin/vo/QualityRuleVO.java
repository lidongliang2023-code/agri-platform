package com.agri.admin.vo;

import lombok.Data;

/** 质量规则（运营端「数据质量 → 规则配置」）。 */
@Data
public class QualityRuleVO {

    private Long id;
    private String ruleCode;
    private String ruleName;
    private String ruleType;
    private String description;
    private String targetDomain;
    private String targetTable;
    private String targetField;
    private String expression;
    private Integer threshold;
    private String severity;
    private Integer status;
    private String createTime;
}
