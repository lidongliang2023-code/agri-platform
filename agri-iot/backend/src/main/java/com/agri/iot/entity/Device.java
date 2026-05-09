package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device")
public class Device extends BaseEntity {

    private String deviceCode;

    private String deviceName;

    private Long deviceTypeId;

    private Long gatewayId;

    private Long parentId;

    private Long plotId;

    private BigDecimal locationLat;

    private BigDecimal locationLng;

    private String locationName;

    private Integer onlineStatus;

    private java.time.LocalDateTime lastOnlineTime;

    private java.time.LocalDateTime lastReportTime;

    private String deviceStatus;

    private String protocol;

    private String firmwareVersion;

    private String configJson;

    private Integer status;

    private Integer delFlag;
}