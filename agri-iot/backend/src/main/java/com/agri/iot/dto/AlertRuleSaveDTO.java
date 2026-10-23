package com.agri.iot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AlertRuleSaveDTO {

    @NotBlank(message = "规则编码不能为空")
    private String ruleCode;

    @NotBlank(message = "规则名称不能为空")
    private String ruleName;

    private String ruleType;

    private Long deviceTypeId;

    private String propertyCode;

    private String propertyName;

    @NotBlank(message = "运算符不能为空")
    private String operator;

    @NotBlank(message = "阈值不能为空")
    private String thresholdValue;

    private Integer durationSeconds;

    @NotNull(message = "告警级别不能为空")
    private Integer alertLevel;

    private String alertChannel;

    private String alertTemplate;

    private Integer enableStatus;
}
