package com.agri.production.vo;

import com.agri.production.entity.IoTDevice;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 运营端设备监控出参（前端 {@code IotDevice}，见 @agri/shared/types/iot）。
 *
 * <p>两处**词表翻译**，都是把库里存的值翻成前端在用的值（不是编数据）：</p>
 * <ul>
 *   <li>{@code deviceType}：库里是文本（sensor / weather_station / camera …），
 *       前端 {@code DeviceType} 是数字（1 传感器 2 摄像头 3 控制器 4 气象站 5 无人机），
 *       页面的筛选下拉也按数字取值 —— 不翻的话"类型"一列会显示成英文原文；</li>
 *   <li>{@code onlineStatus}：库里是文本（online / offline / fault），
 *       前端是 1 在线 / 2 离线 / 3 故障。</li>
 * </ul>
 * <p>原值同时以 {@code deviceTypeText} / {@code status} 保留，翻不出来时页面至少能看到真实取值。</p>
 */
@Data
public class AdminMonitorDeviceVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String deviceId;
    private String deviceCode;
    private String deviceName;
    /** 前端口径：1 传感器 2 摄像头 3 控制器 4 气象站 5 无人机；翻不出来为 null */
    private Integer deviceType;
    /** 库里原值（sensor / weather_station …） */
    private String deviceTypeText;
    private String model;
    private String manufacturer;
    private String firmwareVersion;
    private String farmId;
    private String farmName;
    /** 前端口径：1 在线 2 离线 3 故障 */
    private Integer onlineStatus;
    /** 库里原值（online / offline / fault） */
    private String status;
    private Integer battery;
    private Integer signal;
    private String lastHeartbeatAt;
    private String location;
    private String ipAddress;
    private String protocol;
    private Integer dataInterval;
    private Integer isEnabled;
    /** 最近一次重启指令下发时间（本部署只记录指令，不真重启设备） */
    private String rebootRequestedAt;

    public static AdminMonitorDeviceVO of(IoTDevice entity, String farmName) {
        if (entity == null) {
            return null;
        }
        AdminMonitorDeviceVO vo = new AdminMonitorDeviceVO();
        vo.deviceId = entity.getId() == null ? null : String.valueOf(entity.getId());
        vo.deviceCode = entity.getDeviceCode();
        vo.deviceName = entity.getDeviceName();
        vo.deviceTypeText = entity.getDeviceType();
        vo.deviceType = toFrontendDeviceType(entity.getDeviceType());
        vo.model = entity.getDeviceModel();
        vo.manufacturer = entity.getManufacturer();
        vo.firmwareVersion = entity.getFirmwareVersion();
        vo.farmId = entity.getFarmId() == null ? null : String.valueOf(entity.getFarmId());
        vo.farmName = farmName;
        vo.status = entity.getStatus();
        vo.onlineStatus = toFrontendOnlineStatus(entity.getStatus());
        vo.battery = entity.getBatteryLevel();
        vo.signal = entity.getSignalStrength();
        vo.lastHeartbeatAt = format(entity.getLastOnlineTime());
        vo.location = entity.getLocation();
        vo.ipAddress = entity.getIpAddress();
        vo.protocol = entity.getProtocol();
        vo.dataInterval = entity.getDataInterval();
        vo.isEnabled = entity.getIsEnabled();
        vo.rebootRequestedAt = format(entity.getRebootRequestedAt());
        return vo;
    }

    /** 统一到秒：LocalDateTime.toString() 会带纳秒（…19.267187400），直接丢给前端很难看 */
    private static String format(LocalDateTime value) {
        return value == null ? null : DATE_TIME.format(value);
    }

    /** 文本 → 前端数字类型；认不出返回 null（页面显示"—"，不猜一个类型安上去） */
    public static Integer toFrontendDeviceType(String text) {
        if (text == null) {
            return null;
        }
        return switch (text.trim().toLowerCase()) {
            case "sensor", "sensors" -> 1;
            case "camera", "video" -> 2;
            case "controller", "irrigation" -> 3;
            case "weather_station", "weather", "meteorological" -> 4;
            case "drone", "uav" -> 5;
            default -> null;
        };
    }

    /** 文本 → 1 在线 / 2 离线 / 3 故障；认不出返回 null */
    public static Integer toFrontendOnlineStatus(String text) {
        if (text == null) {
            return null;
        }
        return switch (text.trim().toLowerCase()) {
            case "online", "connected" -> 1;
            case "offline", "disconnected" -> 2;
            case "fault", "error", "broken" -> 3;
            default -> null;
        };
    }
}
