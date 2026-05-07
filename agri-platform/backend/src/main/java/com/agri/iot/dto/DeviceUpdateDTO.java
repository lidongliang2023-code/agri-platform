package com.agri.iot.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DeviceUpdateDTO {

    @NotNull(message = "设备ID不能为空")
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

    private Integer status;
}
