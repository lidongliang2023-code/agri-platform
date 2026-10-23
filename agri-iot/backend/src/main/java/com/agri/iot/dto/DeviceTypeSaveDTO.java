package com.agri.iot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeviceTypeSaveDTO {

    @NotBlank(message = "类型编码不能为空")
    private String typeCode;

    @NotBlank(message = "类型名称不能为空")
    private String typeName;

    private String typeCategory;

    private String icon;

    private String protocol;

    private String manufacturer;

    private String model;

    private String specJson;

    private Integer status;
}
