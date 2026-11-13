package com.agri.iot.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 设备采样约定。
 *
 * <p>旧版本只有 reportInterval/samplingToleranceSeconds 两个设备级字段；
 * 新版本在 samplingByMetric 下按指标保存独立约定。旧字段仍作为未单独配置指标的回退值。</p>
 */
public record SamplingPolicy(Integer intervalSeconds, int toleranceSeconds, LocalDateTime effectiveAt,
                             Map<String, MetricPolicy> byMetric) {
    private static final ObjectMapper JSON = new ObjectMapper();

    public record MetricPolicy(Integer intervalSeconds, int toleranceSeconds, LocalDateTime effectiveAt) {
        public long maxGapSeconds(int fallbackDuration) {
            return intervalSeconds == null ? fallbackDuration : (long) intervalSeconds + toleranceSeconds;
        }
    }

    /** 保持旧调用方的三参数构造方式。 */
    public SamplingPolicy(Integer intervalSeconds, int toleranceSeconds, LocalDateTime effectiveAt) {
        this(intervalSeconds, toleranceSeconds, effectiveAt, Map.of());
    }

    public SamplingPolicy {
        byMetric = byMetric == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(byMetric));
    }

    public static ObjectNode object(String config) {
        try {
            JsonNode node = JSON.readTree(config == null || config.isBlank() ? "{}" : config);
            if (!(node instanceof ObjectNode object)) throw new IllegalArgumentException("设备配置必须是 JSON 对象");
            return object;
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("设备配置必须是有效的 JSON 对象");
        }
    }

    private static int integer(JsonNode node, String field, int min, int max) {
        if (node == null || !node.isIntegralNumber() || !node.canConvertToInt()
                || node.intValue() < min || node.intValue() > max) {
            throw new IllegalArgumentException(field + " 需要 " + min + "～" + max + " 之间的整数秒");
        }
        return node.intValue();
    }

    private static LocalDateTime time(JsonNode value, String message) {
        if (value == null || value.isNull() || value.asText().isBlank()) return null;
        try {
            return LocalDateTime.parse(value.asText().trim().replace(' ', 'T'));
        } catch (RuntimeException e) {
            throw new IllegalArgumentException(message);
        }
    }

    private static MetricPolicy metric(JsonNode node, String key) {
        if (!(node instanceof ObjectNode object)) throw new IllegalArgumentException("指标「" + key + "」配置必须是对象");
        Integer interval = null;
        int tolerance = 0;
        if (object.has("reportInterval")) interval = integer(object.get("reportInterval"), "指标「" + key + "」采样周期", 1, 86400);
        if (object.has("samplingToleranceSeconds")) {
            if (interval == null) throw new IllegalArgumentException("指标「" + key + "」请先配置采样周期");
            tolerance = integer(object.get("samplingToleranceSeconds"), "指标「" + key + "」允许延迟", 0, interval);
        }
        return new MetricPolicy(interval, tolerance, time(object.get("samplingEffectiveAt"), "指标「" + key + "」生效时间无效"));
    }

    public static SamplingPolicy validate(ObjectNode node) {
        Integer interval = null;
        int tolerance = 0;
        if (node.has("reportInterval")) interval = integer(node.get("reportInterval"), "reportInterval", 1, 86400);
        if (node.has("samplingToleranceSeconds")) {
            if (interval == null) throw new IllegalArgumentException("请先配置采样周期");
            tolerance = integer(node.get("samplingToleranceSeconds"), "samplingToleranceSeconds", 0, interval);
        }
        LocalDateTime at = time(node.get("samplingEffectiveAt"), "采样配置生效时间无效");
        Map<String, MetricPolicy> byMetric = new LinkedHashMap<>();
        JsonNode metricNode = node.get("samplingByMetric");
        if (metricNode != null) {
            if (!metricNode.isObject()) throw new IllegalArgumentException("samplingByMetric 必须是 JSON 对象");
            metricNode.fields().forEachRemaining(entry -> {
                String key = entry.getKey();
                if (!key.matches("[A-Za-z][A-Za-z0-9_]{0,39}")) throw new IllegalArgumentException("指标标识无效：" + key);
                byMetric.put(key, metric(entry.getValue(), key));
            });
        }
        return new SamplingPolicy(interval, tolerance, at, byMetric);
    }

    /** 旧配置或历史坏配置采用保守策略，不替设备猜测采样周期。 */
    public static SamplingPolicy read(String config) {
        try {
            return validate(object(config));
        } catch (IllegalArgumentException e) {
            return new SamplingPolicy(null, 0, null, Map.of());
        }
    }

    /** 指标独立配置优先，未配置时回退到设备级配置。 */
    public MetricPolicy policyFor(String metricKey) {
        MetricPolicy metric = byMetric.get(metricKey);
        return metric == null ? new MetricPolicy(intervalSeconds, toleranceSeconds, effectiveAt) : metric;
    }

    /** 保留扩展属性；只有对应约定变化时才刷新对应生效时间。 */
    public static String normalize(String config, String previous, boolean creating) {
        ObjectNode node = object(config);
        node.remove("samplingEffectiveAt");
        JsonNode incomingMetrics = node.get("samplingByMetric");
        if (incomingMetrics != null && incomingMetrics.isObject()) {
            ObjectNode normalizedMetrics = (ObjectNode) incomingMetrics;
            ObjectNode oldMetrics = object(previous).with("samplingByMetric");
            normalizedMetrics.fields().forEachRemaining(entry -> {
                String key = entry.getKey();
                ObjectNode item = entry.getValue() instanceof ObjectNode object ? object : JSON.createObjectNode();
                item.remove("samplingEffectiveAt");
                MetricPolicy next = metric(item, key);
                MetricPolicy old = oldMetrics.has(key) ? metric(oldMetrics.get(key), key) : new MetricPolicy(null, 0, null);
                if (creating || !Objects.equals(next.intervalSeconds(), old.intervalSeconds()) || next.toleranceSeconds() != old.toleranceSeconds()) {
                    item.put("samplingEffectiveAt", LocalDateTime.now().toString());
                } else if (old.effectiveAt() != null) {
                    item.put("samplingEffectiveAt", old.effectiveAt().toString());
                }
                normalizedMetrics.set(key, item);
            });
        }
        SamplingPolicy next = validate(node);
        SamplingPolicy old = read(previous);
        if (creating || !Objects.equals(next.intervalSeconds(), old.intervalSeconds()) || next.toleranceSeconds() != old.toleranceSeconds()) {
            node.put("samplingEffectiveAt", LocalDateTime.now().toString());
        } else if (old.effectiveAt() != null) {
            node.put("samplingEffectiveAt", old.effectiveAt().toString());
        }
        return node.toString();
    }

    public long maxGapSeconds(int fallbackDuration) {
        return intervalSeconds == null ? fallbackDuration : (long) intervalSeconds + toleranceSeconds;
    }
}
