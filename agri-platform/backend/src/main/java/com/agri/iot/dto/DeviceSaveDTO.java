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

    private String deviceType;

    private String deviceModel;

    private String manufacturer;

    private String installationLocation;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private Long orgId;

    private Integer status;
}
