package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DeviceTypeVO {

    private Long id;

    private String typeCode;

    private String typeName;

    private String typeCategory;

    private String typeCategoryText;

    private String icon;

    private String protocol;

    private String manufacturer;

    private String model;

    private String specJson;

    private Integer status;

    private String statusText;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    private String createBy;
}