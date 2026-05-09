
package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_group")
public class DeviceGroup extends BaseEntity {

    private String groupName;

    private String groupIcon;

    private String groupColor;

    private String description;

    private Integer isPreset;

    private Integer status;

    private Integer deviceCount;
}
