package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * IoT 设备维修记录。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_iot_maintenance")
public class IotMaintenanceEntity extends ProduceBaseEntity {

    @TableId(value = "maintain_id", type = IdType.INPUT)
    private String maintainId;

    /** 设备ID */
    private String deviceId;

    /** 设备编码（冗余，便于检索） */
    private String deviceCode;

    /** 维修类型 INSPECT/REPAIR/REPLACE/CALIBRATE/UPGRADE */
    private String maintainType;

    /** 维修内容 */
    private String content;

    /** 操作人 */
    private String operator;

    /** 维修时间 */
    private LocalDateTime maintainAt;

    /** 维修结果 */
    private String result;
}
