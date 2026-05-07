package com.agri.monitor.dto;

import lombok.Data;

@Data
public class GatewaySaveDTO {
    private String gatewayCode;
    private String gatewayName;
    private String manufacturer;
    private String model;
    private String firmwareVersion;
    private String ipAddress;
    private Integer port;
    private String protocol;
    private Integer plotId;
    private Integer heartInterval;
    private String location;
    private String remark;
}
