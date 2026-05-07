package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_data")
public class DeviceData extends BaseEntity {

    private Long deviceId;

    private String dataType;

    private String dataValue;

    private String dataUnit;

    private LocalDateTime collectionTime;

    private Integer delFlag;
}
