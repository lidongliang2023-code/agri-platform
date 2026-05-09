package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class DeviceDataVO {

    private Long id;

    private Long deviceId;

    private String deviceCode;

    private String deviceName;

    private Long plotId;

    private String plotName;

    private String dataJson;

    private BigDecimal temperature;

    private BigDecimal humidity;

    private BigDecimal soilMoisture;

    private BigDecimal soilTemp;

    private BigDecimal ph;

    private BigDecimal lightIntensity;

    private BigDecimal co2;

    private String deviceStatus;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime reportTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
}