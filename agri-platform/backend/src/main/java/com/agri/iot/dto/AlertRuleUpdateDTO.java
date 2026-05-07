package com.agri.iot.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AlertRuleUpdateDTO {

    @NotNull(message = "规则ID不能为空")
    private Long id;

    private String ruleCode;

    private String ruleName;

    private String ruleType;

    private Long deviceTypeId;

    private String propertyCode;

    private String propertyName;

    private String operator;

    private String thresholdValue;

    private Integer durationSeconds;

    private Integer alertLevel;

    private String alertChannel;

    private String alertTemplate;

    private Integer enableStatus;
}
