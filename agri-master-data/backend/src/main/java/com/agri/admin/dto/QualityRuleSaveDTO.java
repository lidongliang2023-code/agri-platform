package com.agri.admin.dto;

import lombok.Data;

/** 质量规则新增/修改。 */
@Data
public class QualityRuleSaveDTO {

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
}
