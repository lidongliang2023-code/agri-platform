package com.agri.iot.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DeviceTypeUpdateDTO {

    @NotNull(message = "类型ID不能为空")
    private Long id;

    private String typeCode;

    private String typeName;

    private String typeCategory;

    private String icon;

    private String protocol;

    private String manufacturer;

    private String model;

    private String specJson;

    private Integer status;
}
