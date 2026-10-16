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

    /**
     * 平台侧设备标识（{@code prod_iot_device.device_id}，形如 DEMO-DEV-001）。
     *
     * <p>与 {@code Farm.platformFarmId} 同法：页面/历史数据里出现的是平台侧标识，而本服务的设备主键是数字 id，
     * 靠这一列把标识换算成本地主键（见 {@code IotOpsServiceImpl} 与 schema-mysql.sql 的列注释）。</p>
     */
    @TableField("platform_device_id")
    private String platformDeviceId;

    /**
     * 地块标识（页面口径）。

     *
     * <p>设备列表的"关联地块"列用页面自己的地块名映射（键是平台侧标识 DEMO-PLOT-xxx）渲染，
     * 而本服务的 {@code plot_id} 是数字主键 —— 主数据收敛前用它承载页面口径的标识，
     * 否则那一列永远是"未绑定"、按地块筛选也筛不出设备。</p>
     */
    @TableField("plot_ref")
    private String plotRef;

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
