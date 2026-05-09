package com.agri.iot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DeviceSaveDTO {

    @NotBlank(message = "设备编码不能为空")
    private String deviceCode;

    @NotBlank(message = "设备名称不能为空")
    private String deviceName;

    @NotNull(message = "设备类型不能为空")
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