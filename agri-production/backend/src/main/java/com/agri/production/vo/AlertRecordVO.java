package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AlertRecordVO {

    private Long id;

    private String alertCode;

    private Long ruleId;

    private String ruleCode;

    private String ruleName;

    private String alertType;

    private String level;

    private String levelName;

    private String sourceType;

    private Long sourceId;

    private String sourceName;

    private Long farmId;

    private String farmName;

    private Long plotId;

    private String plotName;

    private String title;

    private String content;

    private BigDecimal value;

    private String unit;

    private String status;

    private String statusName;

    private LocalDateTime handleTime;

    private String handleUser;

    private String handleResult;

    private String remark;

    private Long emergencyPlanId;

    private String emergencyPlanName;

    private String tenantId;

    private LocalDateTime createTime;
}