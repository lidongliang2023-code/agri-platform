package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_property")
public class DeviceProperty extends BaseEntity {

    private Long typeId;

    private String propertyCode;

    private String propertyName;

    private String dataType;

    private String unit;

    private BigDecimal minValue;

    private BigDecimal maxValue;

    private String defaultValue;

    private Integer isReadonly;

    private Integer isControl;

    private Integer displayOrder;

    private Integer delFlag;
}
