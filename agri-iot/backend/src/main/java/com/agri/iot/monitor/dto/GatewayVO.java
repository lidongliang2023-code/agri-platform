package com.agri.monitor.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class GatewayVO {
    private Long id;
    private String gatewayCode;
    private String gatewayName;
    private String manufacturer;
    private String model;
    private String firmwareVersion;
    private String ipAddress;
    private Integer port;
    private String protocol;
    private Integer plotId;
    private String plotName;
    private Integer onlineStatus;
    private Integer heartInterval;
    private String location;
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
