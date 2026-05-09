package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_data")
public class DeviceData extends BaseEntity {

    private Long deviceId;

    private String deviceCode;

    private Long plotId;

    private String dataJson;

    private BigDecimal temperature;

    private BigDecimal humidity;

    private BigDecimal soilMoisture;

    private BigDecimal soilTemp;

    private BigDecimal ph;

    private BigDecimal lightIntensity;

    private BigDecimal co2;

    private String deviceStatus;

    private LocalDateTime reportTime;

    private Integer delFlag;
}