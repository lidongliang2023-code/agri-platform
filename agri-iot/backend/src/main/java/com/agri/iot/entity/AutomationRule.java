package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_automation_rule")
public class AutomationRule extends BaseEntity {

    private String ruleCode;

    private String ruleName;

    private String ruleType;

    private String description;

    private String triggerConfig;

    private String conditionGroup;

    private String actionList;

    private Integer cooldownSeconds;

    private Integer priority;

    private Integer enableStatus;

    private LocalDateTime lastTriggerTime;

    private Integer triggerCount;

    private Integer delFlag;
}
