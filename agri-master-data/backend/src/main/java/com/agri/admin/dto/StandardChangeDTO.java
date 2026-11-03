package com.agri.admin.dto;

import lombok.Data;

/** 标准变更申请入参。审批只记录决策，不自动改写目标。 */
@Data
public class StandardChangeDTO {

    /** format / dict / code_rule */
    private String targetType;

    private String targetId;

    private String targetName;

    /** CREATE / UPDATE / DISABLE */
    private String changeType;

    private String beforeValue;

    private String afterValue;

    private String remark;
}
