package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_alert_rule")
public class AlertRule extends BaseEntity {

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

    private Integer delFlag;
}