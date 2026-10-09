package com.agri.produce.internal.device;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 设备档案（管理侧）：连接与数据采集在卫星服务 satellite-iot（ADR-002 按伸缩特征拆分）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_device")
public class DeviceEntity extends BaseEntity {

    private String deviceNo;
    private String name;
    /** SENSOR / CONTROLLER / CAMERA */
    private String type;
    private Long plotId;
    /** 1=在线 0=离线 */
    private Integer status;
}
