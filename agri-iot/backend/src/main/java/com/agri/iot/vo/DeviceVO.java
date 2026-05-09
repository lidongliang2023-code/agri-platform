package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class DeviceVO {

    private Long id;

    private String deviceCode;

    private String deviceName;

    private Long deviceTypeId;

    private String deviceTypeName;

    private String deviceTypeCategory;

    private Long gatewayId;

    private String gatewayName;

    private Long plotId;

    private String plotName;

    private BigDecimal locationLat;

    private BigDecimal locationLng;

    private String locationName;

    private Integer onlineStatus;

    private String onlineStatusText;

    private LocalDateTime lastOnlineTime;

    private LocalDateTime lastReportTime;

    private String deviceStatus;

    private String deviceStatusText;

    private String protocol;

    private String firmwareVersion;

    private Integer status;

    private String statusText;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    private String createBy;
}