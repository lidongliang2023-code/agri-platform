package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device")
public class Device extends BaseEntity {

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

    private Integer delFlag;
}
