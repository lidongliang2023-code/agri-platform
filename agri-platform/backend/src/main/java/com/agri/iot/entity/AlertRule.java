package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_alert_rule")
public class AlertRule extends BaseEntity {

    private String ruleName;

    private String ruleDesc;

    private Long deviceId;

    private String dataType;

    private String operator;

    private String thresholdValue;

    private Integer alertLevel;

    private Integer status;

    private Integer delFlag;
}
