
package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_device_group_relation")
public class DeviceGroupRelation extends BaseEntity {

    private Long groupId;

    private Long deviceId;
}
