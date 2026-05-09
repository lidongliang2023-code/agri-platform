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

    private Long deviceTypeId;

    private Long gatewayId;

    private Long parentId;

    private Long plotId;

    private BigDecimal locationLat;

    private BigDecimal locationLng;

    private String locationName;

    private String protocol;

    private String firmwareVersion;

    private String configJson;

    private Integer status;
}