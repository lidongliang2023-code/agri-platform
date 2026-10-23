package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class RealtimeDataVO {

    private Long deviceId;

    private String deviceCode;

    private String deviceName;

    private String deviceTypeName;

    private Long plotId;

    private String plotName;

    private BigDecimal temperature;

    private BigDecimal humidity;

    private BigDecimal soilMoisture;

    private BigDecimal soilTemp;

    private BigDecimal ph;

    private BigDecimal lightIntensity;

    private BigDecimal co2;

    private String deviceStatus;

    private String onlineStatus;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime reportTime;
}
