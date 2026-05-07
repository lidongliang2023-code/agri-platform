package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AlertRuleVO {

    private Long id;

    private String ruleCode;

    private String ruleName;

    private String ruleType;

    private String ruleTypeText;

    private Long deviceTypeId;

    private String deviceTypeName;

    private String propertyCode;

    private String propertyName;

    private String operator;

    private String thresholdValue;

    private Integer durationSeconds;

    private Integer alertLevel;

    private String alertLevelText;

    private String alertChannel;

    private String alertTemplate;

    private Integer enableStatus;

    private String enableStatusText;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    private String createBy;
}
