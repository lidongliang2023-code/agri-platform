package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * IoT 设备档案（采集与长连接在 satellite-iot）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_iot_device")
public class IotDeviceEntity extends ProduceBaseEntity {

    @TableId(value = "device_id", type = IdType.INPUT)
    private String deviceId;

    /** 设备编码（全局唯一） */
    private String deviceCode;

    /** 设备名称 */
    private String deviceName;

    /** 设备类型 SENSOR/CONTROLLER/CAMERA */
    private String deviceType;

    /** 农场ID */
    private String farmId;

    /** 地块ID */
    private String plotId;

    /** 厂商 */
    private String manufacturer;

    /** 型号 */
    private String model;

    /** 固件版本 */
    private String firmware;

    /** 安装日期 */
    private LocalDate installDate;

    /** 在线状态 1在线 0离线 */
    private Integer onlineFlag;

    /** 最后心跳 */
    private LocalDateTime lastHeartbeatAt;

    /** 状态 1启用 0停用 */
    private Integer status;
}
