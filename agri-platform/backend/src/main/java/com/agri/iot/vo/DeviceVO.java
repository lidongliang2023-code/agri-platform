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

    private String deviceType;

    private String deviceModel;

    private String manufacturer;

    private String installationLocation;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private Long orgId;

    private String orgName;

    private Integer status;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
}
