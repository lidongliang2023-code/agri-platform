package com.agri.iot.support;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 物联网指标与阈值的公共口径。
 *
 * <p>名称映射以前只写在 {@code IotAppRepository} 里：设备详情、大盘环境卡片认得这些键，
 * 新的阈值判定（{@code IotAlertRuleRepository}）再抄一份就会开始漂移——同一个指标在
 * 一处显示"土壤含水率"、另一处显示"soil_moisture"，用户就分不清自己配的是哪一条。</p>
 */
public final class IotMetrics {

    /** 允许的比较符；前端下拉与后端校验共用这一份。 */
    public static final List<String> OPERATORS = List.of(">", ">=", "<", "<=");

    /** 告警等级，越靠前越严重。 */
    public static final List<String> LEVELS = List.of("critical", "major", "normal");

    /** 执行器状态类指标：是设备动作的结果，不作为"环境读数"参与阈值展示。 */
    public static final List<String> ACTUATOR_KEYS =
            List.of("switch", "position", "speed", "stream", "pan", "tilt", "online", "device_count");

    private static final Map<String, String> NAMES = Map.ofEntries(
            Map.entry("temperature", "空气温度"),
            Map.entry("humidity", "空气湿度"),
            Map.entry("soil_moisture", "土壤含水率"),
            Map.entry("soil_temp", "土壤温度"),
            Map.entry("ph", "pH"),
            Map.entry("light_intensity", "光照强度"),
            Map.entry("light", "光照强度"),
            Map.entry("co2", "CO₂浓度"),
            Map.entry("switch", "开关状态"),
            Map.entry("flow", "流量"),
            Map.entry("ec", "EC值"),
            Map.entry("rain", "降雨量"),
            Map.entry("pest_count", "虫情数量"),
            Map.entry("water_level", "水位"),
            Map.entry("ammonia", "氨气浓度"),
            Map.entry("wind", "风速"),
            Map.entry("position", "开度"),
            Map.entry("speed", "转速"));

    private IotMetrics() {
    }

    public static String metricName(String key) {
        if (key == null) {
            return "";
        }
        return NAMES.getOrDefault(key, key);
    }

    /** 等级轻重：数值越大越严重，未知等级按"一般"处理，不让它冒到 critical 上面。 */
    public static int levelRank(String level) {
        int index = LEVELS.indexOf(level);
        return index < 0 ? LEVELS.size() : index;
    }

    /**
     * 单点越线判定。
     *
     * @return 读数为 null、阈值不是数字、比较符不认识时都返回 false（不猜）
     */
    public static boolean breaches(String operator, BigDecimal value, BigDecimal threshold) {
        if (value == null || threshold == null || operator == null) {
            return false;
        }
        int compare = value.compareTo(threshold);
        return switch (operator) {
            case ">" -> compare > 0;
            case ">=" -> compare >= 0;
            case "<" -> compare < 0;
            case "<=" -> compare <= 0;
            default -> false;
        };
    }
}
