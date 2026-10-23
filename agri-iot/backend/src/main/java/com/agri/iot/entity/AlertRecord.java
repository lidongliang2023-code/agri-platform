package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_alert_record")
public class AlertRecord extends BaseEntity {

    private String alertNo;

    private Long ruleId;

    private String ruleName;

    private Long deviceId;

    private String deviceCode;

    private String deviceName;

    private Long plotId;

    private String plotName;

    private Integer alertLevel;

    private String propertyCode;

    private String propertyName;

    private String triggerValue;

    private String thresholdValue;

    private String alertContent;

    private LocalDateTime alertTime;

    private Integer handleStatus;

    private LocalDateTime handleTime;

    private String handleUser;

    private String handleResult;

    private Integer delFlag;
}
