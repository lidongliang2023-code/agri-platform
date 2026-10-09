package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * IoT 监测读数（时序，卫星服务回传）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_iot_reading")
public class IotReadingEntity extends ProduceBaseEntity {

    @TableId(value = "reading_id", type = IdType.INPUT)
    private String readingId;

    /** 设备ID */
    private String deviceId;

    /** 设备编码 */
    private String deviceCode;

    /** 地块ID */
    private String plotId;

    /** 监测指标 */
    private String metric;

    /** 读数 */
    private BigDecimal metricValue;

    /** 单位 */
    private String unit;

    /** 采集时间 */
    private LocalDateTime readTime;

    /** 数据质量 1正常 0异常 */
    private Integer qualityFlag;

    /** 原始报文 */
    private String rawPayload;
}
