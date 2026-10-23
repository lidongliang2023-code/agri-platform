package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_control_log")
public class DeviceControlLog extends BaseEntity {

    private Long deviceId;

    private String deviceCode;

    private String commandType;

    private String commandContent;

    private Integer status;

    private LocalDateTime sendTime;

    private LocalDateTime executeTime;

    private String responseContent;

    private String errorMessage;

    private String operator;

    private Integer delFlag;
}
