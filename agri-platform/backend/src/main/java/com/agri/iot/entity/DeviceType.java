package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_type")
public class DeviceType extends BaseEntity {

    private String typeCode;

    private String typeName;

    private String typeCategory;

    private String icon;

    private String protocol;

    private String manufacturer;

    private String model;

    private String specJson;

    private Integer status;

    private Integer delFlag;
}
