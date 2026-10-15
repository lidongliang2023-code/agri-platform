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

    /** 上报间隔（秒）。列本来就在表里（data_interval），此前没被映射 */
    @TableField("data_interval")
    private Integer dataInterval;

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

    /**
     * 最近一次重启指令下发时间（列见 schema-patch-monitor-page.sql）。
     *
     * <p>语义就是"指令已记录、待设备侧执行"——本部署没有设备网关，不会真去重启设备，
     * 页面文案也是"重启指令已下发"，两边一致。</p>
     */
    @TableField("reboot_requested_at")
    private java.time.LocalDateTime rebootRequestedAt;
}
