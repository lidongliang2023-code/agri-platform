package com.agri.production.vo;

import com.agri.production.entity.IoTDevice;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * IoT 设备出参（页面 {@code IotDevice}）。
 *
 * <p><b>为什么要在控制器里转一层</b>：{@code /iot/devices} 原先直接把实体丢给前端，而页面读的是
 * {@code deviceId / onlineStatus / lastHeartbeatAt} 这一套 —— 实体里这三个字段一个都没有，
 * 结果是设备列表的"行 id"是 undefined（详情/编辑链接直接拼成 /undefined）、
 * 每台设备的在线状态都被判成"离线"（{@code Number(undefined)} → NaN → 兜底离线）。
 * 接口 200、页面也能渲染，所以这类问题靠看接口是发现不了的。</p>
 *
 * <p>设备类型与状态的映射见 {@link #deviceTypeCode} / {@link #onlineStatusCode}：
 * 库内是文本（sensor / CONTROLLER / online / offline），页面契约是数字枚举（1~5、1~3）。</p>
 */
@Data
public class IotDeviceVO {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 设备主键（字符串形式，页面所有动作都靠它定位设备） */
    private String deviceId;
    private String deviceCode;
    private String deviceName;
    /** 1 传感器 2 摄像头 3 控制器 4 气象站 5 无人机 */
    private Integer deviceType;
    /** 设备型号（页面字段名是 model） */
    private String model;
    private String manufacturer;
    private String firmwareVersion;
    private String farmId;
    /** 在线状态：1 在线 2 离线 3 故障 */
    private Integer onlineStatus;
    private Integer battery;
    private Integer signal;
    /** 最近心跳（yyyy-MM-dd HH:mm:ss） */
    private String lastHeartbeatAt;
    private String location;
    /** 采集频率（分钟） */
    private Integer dataInterval;
    /**
     * 关联地块标识（页面口径）。

     *
     * <p>页面用它在自己的地块名映射里查名称，所以优先给页面口径的标识（plot_ref）；
     * 没有时才退化成本地地块主键（数字）—— 那时页面会原样显示数字，
     * 至少比"未绑定"更接近事实（设备确实挂在那个本地地块上）。</p>
     */
    private String plotId;
    private String protocol;
    private String createdAt;
    private String updatedAt;

    /**
     * 从物联网系统（{@code /api/v1/iot/app/devices}）的设备对象转换。
     *
     * <p>设备台账已收敛到物联网系统：生产管理不再维护 {@code agri_prod_iot_device} 这份副本，
     * 设备列表/详情一律读物联网端。两边的字段命名体系不同（那边 {@code typeName} 是中文、
     * {@code onlineStatus} 是 online/offline/alert），所以必须在这里做一次显式映射，
     * 不能直接把 Map 丢给页面。</p>
     *
     * <p>物联网端没有的字段（型号 / 厂商 / 安装位置 / 采集频率 / 创建时间）留空 ——
     * 用别的字段顶替会让页面显示一个"看起来对但其实是错的"值。</p>
     */
    public static IotDeviceVO ofIot(java.util.Map<String, Object> row) {
        if (row == null) {
            return null;
        }
        IotDeviceVO vo = new IotDeviceVO();
        vo.deviceId = str(row.get("id"));
        vo.deviceCode = str(row.get("deviceCode"));
        vo.deviceName = str(row.get("deviceName"));
        vo.deviceType = deviceTypeCode(str(row.get("typeName")));
        vo.farmId = str(row.get("farmId"));
        vo.onlineStatus = onlineStatusCode(str(row.get("onlineStatus")));
        vo.battery = intOrNull(row.get("battery"));
        vo.signal = intOrNull(row.get("rssi"));
        // 物联网端的 lastReport 本身就是"30秒前"这种可读文案，直接透给页面
        vo.lastHeartbeatAt = str(row.get("lastReport"));
        vo.plotId = str(row.get("plotId"));
        vo.protocol = str(row.get("protocol"));
        vo.firmwareVersion = str(row.get("firmwareVersion"));
        return vo;
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer intOrNull(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static IotDeviceVO of(IoTDevice entity) {
        if (entity == null) {
            return null;
        }
        IotDeviceVO vo = new IotDeviceVO();
        vo.deviceId = entity.getId() == null ? null : String.valueOf(entity.getId());
        vo.deviceCode = entity.getDeviceCode();
        vo.deviceName = entity.getDeviceName();
        vo.deviceType = deviceTypeCode(entity.getDeviceType());
        vo.model = entity.getDeviceModel();
        vo.manufacturer = entity.getManufacturer();
        vo.firmwareVersion = entity.getFirmwareVersion();
        vo.farmId = entity.getFarmId() == null ? null : String.valueOf(entity.getFarmId());
        vo.onlineStatus = onlineStatusCode(entity.getStatus());
        vo.battery = entity.getBatteryLevel();
        vo.signal = entity.getSignalStrength();
        // 库内真实心跳列是 last_online_time；页面要的是 lastHeartbeatAt（没有就留空，不拿"创建时间"顶替）
        vo.lastHeartbeatAt = entity.getLastOnlineTime() == null
                ? null : DATETIME.format(entity.getLastOnlineTime());
        vo.location = entity.getLocation();
        vo.dataInterval = entity.getDataInterval();
        vo.plotId = entity.getPlotRef() != null ? entity.getPlotRef()
                : (entity.getPlotId() == null ? null : String.valueOf(entity.getPlotId()));
        vo.protocol = entity.getProtocol();
        vo.createdAt = entity.getCreateTime() == null ? null : DATETIME.format(entity.getCreateTime());
        vo.updatedAt = entity.getUpdateTime() == null ? null : DATETIME.format(entity.getUpdateTime());
        return vo;
    }

    /**
     * 设备类型文本 → 页面数字枚举。
     *
     * <p>认不出的类型返回 null（页面用 {@code deviceTypeLabel} 渲染，null 会显示 '-'）——
     * 随便归到"传感器"会让一台摄像头在页面上被当成传感器。</p>
     */
    public static Integer deviceTypeCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String text = raw.trim();
        String lower = text.toLowerCase(Locale.ROOT);
        // 先按精确值匹配（本服务自己的枚举写法）
        Integer exact = switch (lower) {
            case "sensor", "1", "土壤监测", "soil" -> 1;
            case "camera", "video", "2", "视频监控" -> 2;
            case "controller", "irrigation", "3", "灌溉控制" -> 3;
            case "weather_station", "weatherstation", "weather", "4", "气象站" -> 4;
            case "drone", "5", "无人机" -> 5;
            default -> null;
        };
        if (exact != null) {
            return exact;
        }
        // 物联网端的 type_name 是中文自由文本（「空气温湿度传感器」「温室风机」「高清球机摄像头」），
        // 精确匹配认不出，只能按关键词归类。
        if (text.contains("摄像") || text.contains("视频") || lower.contains("camera")) {
            return 2;
        }
        if (text.contains("气象") || lower.contains("weather")) {
            return 4;
        }
        if (text.contains("无人") || lower.contains("drone")) {
            return 5;
        }
        if (text.contains("风机") || text.contains("阀") || text.contains("控制")
                || text.contains("卷帘") || text.contains("泵") || lower.contains("control")) {
            return 3;
        }
        if (text.contains("传感") || text.contains("监测") || text.contains("采集")
                || text.contains("测报") || text.contains("浮标") || text.contains("站")) {
            return 1;
        }
        return null;
    }

    /**
     * 在线状态文本 → 页面数字枚举（1 在线 / 2 离线 / 3 故障）。

     *
     * <p>认不出来时按"离线"（2）—— 与前端 onlineStatusMeta 的兜底一致，
     * 且"离线"是保守判断：把状态不明的设备显示成在线，会让人以为数据正在进来。</p>
     */
    public static Integer onlineStatusCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return 2;
        }
        String text = raw.trim().toLowerCase(Locale.ROOT);
        return switch (text) {
            case "online", "1", "正常" -> 1;
            // 物联网端把"告警中"记成 alert，语义上属于异常而不是离线
            case "fault", "error", "alert", "3", "故障", "告警" -> 3;
            default -> 2;
        };
    }

    /**
     * 页面可能回传数字枚举或文本，统一存成库内文本（与 {@link #deviceTypeCode} 互逆）。
     *
     * @param raw 页面回传值（1~5 / sensor / SENSOR / 传感器 …）
     * @return 库内文本（sensor / camera / controller / weather_station / drone）
     */
    public static String deviceTypeText(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String text = raw.trim();
        Integer code = deviceTypeCode(text);
        if (code == null) {
            // 认不出的写法原样入库：宁可存一个陌生写法，也不要猜成"传感器"
            return text;
        }
        return switch (code) {
            case 2 -> "camera";
            case 3 -> "controller";
            case 4 -> "weather_station";
            case 5 -> "drone";
            default -> "sensor";
        };
    }
}
