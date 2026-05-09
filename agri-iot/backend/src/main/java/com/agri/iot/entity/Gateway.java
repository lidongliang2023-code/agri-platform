package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_gateway")
public class Gateway extends BaseEntity {

    private String gatewayCode;

    private String gatewayName;

    private String gatewayType;

    private String manufacturer;

    private String model;

    private String firmwareVersion;

    private String ipAddress;

    private String macAddress;

    private Long plotId;

    private String locationName;

    private Integer onlineStatus;

    private LocalDateTime lastOnlineTime;

    private Integer connectedDeviceCount;

    private Integer status;

    private Integer delFlag;
}