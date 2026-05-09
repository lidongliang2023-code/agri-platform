package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_alert")
public class Alert extends BaseEntity {

    private String alertTitle;

    private String alertContent;

    private Integer alertLevel;

    private Long deviceId;

    private Long ruleId;

    private String dataValue;

    private Integer handleStatus;

    private LocalDateTime handleTime;

    private String handleRemark;

    private Integer delFlag;
}