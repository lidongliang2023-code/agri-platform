package com.agri.iot.service;

import com.agri.iot.integration.IotIdentityService;
import com.agri.iot.support.IotMetrics;
import com.agri.iot.support.SamplingPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeviceSamplingService {
    private final JdbcTemplate jdbc;
    private final IotIdentityService identity;
    private final ObjectMapper json = new ObjectMapper();

    public DeviceSamplingService(JdbcTemplate jdbc, IotIdentityService identity) {
        this.jdbc = jdbc;
        this.identity = identity;
    }

    public Map<String, Object> get(long id, boolean operator) {
        if (!operator) identity.requireDeviceAccess(id);
        else identity.requireOperatorName();
        var rows = jdbc.queryForList("SELECT type_name,config_text FROM iot_device WHERE id=?", id);
        if (rows.isEmpty()) throw com.agri.common.exception.BusinessException.notFound("设备不存在");
        Map<String, Object> device = rows.get(0);
        SamplingPolicy policy = SamplingPolicy.read((String) device.get("config_text"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("intervalSeconds", policy.intervalSeconds());
        result.put("toleranceSeconds", policy.toleranceSeconds());
        result.put("effectiveAt", policy.effectiveAt() == null ? null : policy.effectiveAt().toString());
        result.put("maxGapSeconds", policy.intervalSeconds() == null ? null : policy.maxGapSeconds(0));
        List<String> keys = metricKeys(String.valueOf(device.get("type_name")), policy);
        List<Map<String, Object>> metrics = new ArrayList<>();
        for (String key : keys) {
            SamplingPolicy.MetricPolicy item = policy.byMetric().get(key);
            boolean enabled = item != null && item.intervalSeconds() != null;
            SamplingPolicy.MetricPolicy effective = item == null
                    ? policy.policyFor(key) : item;
            Map<String, Object> metric = new LinkedHashMap<>();
            metric.put("metricKey", key);
            metric.put("metricName", IotMetrics.metricName(key));
            metric.put("enabled", enabled);
            metric.put("intervalSeconds", item == null ? null : item.intervalSeconds());
            metric.put("toleranceSeconds", item == null ? 0 : item.toleranceSeconds());
            metric.put("effectiveIntervalSeconds", effective.intervalSeconds());
            metric.put("effectiveToleranceSeconds", effective.toleranceSeconds());
            metric.put("maxGapSeconds", effective.intervalSeconds() == null ? null : effective.maxGapSeconds(0));
            metric.put("effectiveAt", item == null || item.effectiveAt() == null ? null : item.effectiveAt().toString());
            metrics.add(metric);
        }
        result.put("metrics", metrics);
        result.put("fallbackDescription", policy.intervalSeconds() == null ? "未配置时按规则持续时长保守判定" : "未单独配置指标时使用设备默认值");
        return result;
    }

    @Transactional
    public Map<String, Object> save(long id, Map<String, Object> body, boolean operator) {
        if (!operator) identity.requireDeviceAccess(id);
        String actor = identity.requireOperatorName();
        var rows = jdbc.queryForList("SELECT device_code,type_name,config_text FROM iot_device WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw com.agri.common.exception.BusinessException.notFound("设备不存在");
        String old = (String) rows.get(0).get("config_text");
        ObjectNode node = SamplingPolicy.object(old);
        Object interval = body.get("intervalSeconds"), tolerance = body.get("toleranceSeconds");
        if (interval == null) {
            node.remove("reportInterval");
            node.remove("samplingToleranceSeconds");
        } else {
            node.set("reportInterval", json.valueToTree(interval));
            node.set("samplingToleranceSeconds", json.valueToTree(tolerance == null ? 0 : tolerance));
        }
        Object rawMetrics = body.get("metrics");
        if (rawMetrics instanceof List<?> list) {
            ObjectNode byMetric = node.with("samplingByMetric");
            for (Object raw : list) {
                if (!(raw instanceof Map<?, ?> entry)) throw new IllegalArgumentException("指标采样配置格式无效");
                String key = String.valueOf(entry.get("metricKey"));
                if (!key.matches("[A-Za-z][A-Za-z0-9_]{0,39}")) throw new IllegalArgumentException("指标标识无效：" + key);
                Object enabled = entry.get("enabled");
                if (Boolean.FALSE.equals(enabled) || "false".equalsIgnoreCase(String.valueOf(enabled))) {
                    byMetric.remove(key);
                    continue;
                }
                Object metricInterval = entry.get("intervalSeconds");
                if (metricInterval == null || String.valueOf(metricInterval).isBlank()) {
                    byMetric.remove(key);
                    continue;
                }
                ObjectNode item = json.createObjectNode();
                item.set("reportInterval", json.valueToTree(metricInterval));
                item.set("samplingToleranceSeconds", json.valueToTree(entry.get("toleranceSeconds") == null ? 0 : entry.get("toleranceSeconds")));
                byMetric.set(key, item);
            }
            if (byMetric.isEmpty()) node.remove("samplingByMetric");
        }
        String config = SamplingPolicy.normalize(node.toString(), old, false);
        jdbc.update("UPDATE iot_device SET config_text=? WHERE id=?", config, id);
        SamplingPolicy before = SamplingPolicy.read(old), after = SamplingPolicy.read(config);
        jdbc.update("INSERT INTO iot_ops_log(operator_name,action_name,target_name,detail_text,ip_address,created_at) VALUES(?,?,?,?,?,?)",
                actor, "修改采样配置", rows.get(0).get("device_code"),
                "设备默认周期 " + before.intervalSeconds() + " → " + after.intervalSeconds()
                        + " 秒；按指标独立配置 " + after.byMetric().size() + " 项；未下发硬件配置",
                "", LocalDateTime.now().toString().replace('T', ' '));
        return get(id, operator);
    }

    private List<String> metricKeys(String typeName, SamplingPolicy policy) {
        List<String> keys = new ArrayList<>();
        var rows = jdbc.queryForList("SELECT property_text FROM iot_device_type WHERE type_name=?", typeName);
        if (!rows.isEmpty()) {
            String text = String.valueOf(rows.get(0).get("property_text"));
            for (String key : text.split(",")) if (!key.isBlank() && !keys.contains(key.trim())) keys.add(key.trim());
        }
        policy.byMetric().keySet().stream().filter(key -> !keys.contains(key)).forEach(keys::add);
        return keys;
    }
}
