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
@TableName("agri_prod_iot_device")
public class IoTDevice extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("device_code")
    private String deviceCode;

    @TableField("device_name")
    private String deviceName;

    @TableField("device_type")
    private String deviceType;

    @TableField("device_model")
    private String deviceModel;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("location")
    private String location;

    @TableField("status")
    private String status;

    @TableField("ip_address")
    private String ipAddress;

    @TableField("mac_address")
    private String macAddress;

    @TableField("protocol")
    private String protocol;

    @TableField("install_date")
    private java.time.LocalDateTime installDate;

    @TableField("last_online_time")
    private java.time.LocalDateTime lastOnlineTime;

    @TableField("battery_level")
    private Integer batteryLevel;

    @TableField("signal_strength")
    private Integer signalStrength;

    @TableField("manufacturer")
    private String manufacturer;

    @TableField("serial_number")
    private String serialNumber;

    @TableField("firmware_version")
    private String firmwareVersion;

    @TableField("description")
    private String description;

    @TableField("is_enabled")
    private Integer isEnabled;
}