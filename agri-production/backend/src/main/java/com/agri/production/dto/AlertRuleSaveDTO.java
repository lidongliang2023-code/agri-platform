package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AlertRuleSaveDTO {

    private Long id;

    @NotBlank(message = "规则名称不能为空")
    private String ruleName;

    private String alertType;

    private String level;

    private String sourceType;

    private Long sourceId;

    private String conditionExpression;

    private BigDecimal thresholdMin;

    private BigDecimal thresholdMax;

    private String unit;

    private String description;

    private Integer isEnabled;

    private String notifyUsers;

    private String notifyMethods;

    private Integer remindInterval;

    private Integer autoHandle;

    private String handleScript;
}