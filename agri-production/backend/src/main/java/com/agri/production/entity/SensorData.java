package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_sensor_data")
public class SensorData extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("device_id")
    private Long deviceId;

    @TableField("device_code")
    private String deviceCode;

    @TableField("sensor_type")
    private String sensorType;

    @TableField("sensor_name")
    private String sensorName;

    @TableField("value")
    private java.math.BigDecimal value;

    @TableField("unit")
    private String unit;

    @TableField("data_time")
    private java.time.LocalDateTime dataTime;

    @TableField("quality_flag")
    private String qualityFlag;

    @TableField("raw_data")
    private String rawData;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;
}