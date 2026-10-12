package com.agri.admin.dto;

import lombok.Data;

import java.util.List;

/** 检测任务新增/修改。 */
@Data
public class QualityTaskSaveDTO {

    private String taskCode;
    private String taskName;
    private String taskType;
    private String cronExpression;
    private String status;
    /** 关联的规则 ID；传了就整体替换该任务的规则集合 */
    private List<Long> ruleIds;
}
