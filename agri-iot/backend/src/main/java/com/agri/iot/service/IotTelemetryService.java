package com.agri.iot.service;

import com.agri.iot.repository.IotAlertRuleRepository;
import com.agri.iot.support.IotMetrics;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** 认证后的采集入口：设备行锁串行化上报，遥测、触发状态、告警和消息同事务提交。 */
@Service
public class IotTelemetryService {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");
    private final JdbcTemplate jdbc;
    private final IotAlertRuleRepository rules;

    public record Reading(String metricKey, BigDecimal value, String unit) {}
    public record Report(String reportId, Long deviceId, String recordedAt, List<Reading> readings) {}

    public IotTelemetryService(JdbcTemplate jdbc, IotAlertRuleRepository rules) {
        this.jdbc = jdbc;
        this.rules = rules;
    }

    @Transactional
    public Map<String, Object> ingestDevice(long deviceId, Report report) {
        if (report == null || report.deviceId() != null && report.deviceId() != deviceId)
            throw new IllegalArgumentException("载荷设备与认证设备不一致");
        return ingest(deviceId, null, report);
    }

    @Transactional
    public Map<String, Object> ingestGateway(long gatewayId, Report report) {
        if (report == null || report.deviceId() == null) throw new IllegalArgumentException("网关上报必须指定设备");
        List<Map<String, Object>> gateways = jdbc.queryForList("SELECT farm_id FROM iot_gateway WHERE id=? FOR UPDATE", gatewayId);
        if (gateways.isEmpty()) throw new IllegalArgumentException("网关不存在");
        return ingest(report.deviceId(), Map.of("id", gatewayId, "farm", gateways.get(0).get("farm_id")), report);
    }

    private Map<String, Object> ingest(long deviceId, Map<String,Object> gateway, Report report) {
        List<Map<String, Object>> devices = jdbc.queryForList("SELECT * FROM iot_device WHERE id=? FOR UPDATE", deviceId);
        if (devices.isEmpty()) throw new IllegalArgumentException("设备不存在");
        Map<String, Object> device = devices.get(0);
        if (gateway != null && (!Objects.equals(number(device.get("gateway_id")), number(gateway.get("id")))
                || !Objects.equals(number(device.get("farm_id")), number(gateway.get("farm")))))
            throw new IllegalArgumentException("设备不属于该网关及农场");
        if (report.reportId() == null || !report.reportId().matches("[A-Za-z0-9_.:-]{1,80}"))
            throw new IllegalArgumentException("reportId需要1至80位字母、数字或_.:-，重传必须复用原编号");
        LocalDateTime sampledAt = parse(report.recordedAt());
        if (sampledAt == null || sampledAt.getNano() % 1_000_000 != 0)
            throw new IllegalArgumentException("采样时间必须为本地日期时间，精度不超过毫秒");
        if (report.readings() == null || report.readings().isEmpty() || report.readings().size() > 64)
            throw new IllegalArgumentException("一次上报需包含1至64个不同指标");
        TreeMap<String, Reading> readings = new TreeMap<>();
        for (Reading reading : report.readings()) {
            if (reading == null || reading.metricKey() == null || !reading.metricKey().matches("[A-Za-z][A-Za-z0-9_]{0,39}")
                    || reading.value() == null || reading.value().stripTrailingZeros().scale() > 3
                    || reading.value().abs().compareTo(new BigDecimal("999999999.999")) > 0
                    || reading.unit() != null && reading.unit().length() > 20)
                throw new IllegalArgumentException("指标标识、数值或单位无效；数值最多9位整数、3位小数");
            if (readings.put(reading.metricKey(), reading) != null) throw new IllegalArgumentException("同一报文不能重复上报同一指标");
        }
        String at = sampledAt.format(TIME);
        StringBuilder canonical = new StringBuilder(at);
        readings.forEach((key, reading) -> canonical.append('|').append(key).append(':')
                .append(reading.value().stripTrailingZeros().toPlainString()).append(':')
                .append(Base64.getEncoder().encodeToString(Objects.toString(reading.unit(), "").getBytes(StandardCharsets.UTF_8))));
        String hash = hash(canonical.toString());
        List<String> prior = jdbc.queryForList("SELECT payload_hash FROM iot_telemetry_report WHERE device_id=? AND report_id=?",
                String.class, deviceId, report.reportId());
        if (!prior.isEmpty()) {
            if (!hash.equals(prior.get(0))) throw new IllegalArgumentException("同一reportId的内容发生变化，拒绝覆盖");
            return Map.of("reportId", report.reportId(), "duplicate", true, "readingsSaved", 0, "alertsCreated", 0, "recoveries", 0);
        }
        LocalDateTime now = LocalDateTime.now();
        if (sampledAt.isAfter(now.plusSeconds(60)) || sampledAt.isBefore(now.minusHours(24)))
            throw new IllegalArgumentException("只接受最近24小时且不超前60秒的采样；历史导入不得走实时告警通道");
        jdbc.update("INSERT INTO iot_telemetry_report(device_id,report_id,payload_hash,received_at) VALUES(?,?,?,?)",
                deviceId, report.reportId(), hash, now.format(TIME));
        long tenantId = number(device.get("tenant_id"));
        List<Map<String, Object>> effective = rules.effectiveRulesForDevice(tenantId, Objects.toString(device.get("type_name"), ""));
        int created = 0, recovered = 0, saved = 0;
        for (Reading reading : readings.values()) {
            LocalDateTime previous = jdbc.queryForList("SELECT recorded_at FROM iot_telemetry WHERE device_id=? AND metric_key=?", String.class,
                    deviceId, reading.metricKey()).stream().map(IotTelemetryService::parse).filter(Objects::nonNull)
                    .max(Comparator.naturalOrder()).orElse(null);
            // 同一采样时刻不得通过换reportId重写；相同内容视为已有采样，冲突内容拒绝。
            List<Map<String,Object>> sameTime = jdbc.queryForList("SELECT metric_value,unit_name,recorded_at FROM iot_telemetry WHERE device_id=? AND metric_key=?", deviceId, reading.metricKey())
                    .stream().filter(row -> sampledAt.equals(parse(Objects.toString(row.get("recorded_at"), "")))).toList();
            if (!sameTime.isEmpty()) {
                if (sameTime.stream().anyMatch(row -> reading.value().compareTo(new BigDecimal(row.get("metric_value").toString())) != 0
                        || !Objects.toString(reading.unit(), "").equals(Objects.toString(row.get("unit_name"), ""))))
                    throw new IllegalArgumentException("同一设备指标在该采样时刻已有不同读数，禁止覆盖");
                continue;
            }
            jdbc.update("INSERT INTO iot_telemetry(device_id,metric_key,metric_value,unit_name,recorded_at) VALUES(?,?,?,?,?)",
                    deviceId, reading.metricKey(), reading.value(), reading.unit(), at);
            saved++;
            if (previous != null && !sampledAt.isAfter(previous)) continue; // 补报只入库，不倒推当前事件。
            List<Map<String,Object>> metricRules = effective.stream().filter(r -> reading.metricKey().equals(r.get("metricKey"))).toList();
            Set<String> retained = new HashSet<>();
            for (Map<String,Object> rule : metricRules) {
                String source = rule.get("source").toString(); long ruleId = number(rule.get("id"));
                retained.add(source + ":" + ruleId);
                com.agri.iot.support.SamplingPolicy.MetricPolicy samplingPolicy =
                        com.agri.iot.support.SamplingPolicy.read((String) device.get("config_text")).policyFor(reading.metricKey());
                String fingerprint = hash(source + ":" + ruleId + ":" + rule.get("operator") + ":" + rule.get("threshold")
                        + ":" + rule.get("durationSeconds") + ":" + rule.get("level") + ":" + rule.get("deviceType")
                        + ":sampling=" + samplingPolicy.intervalSeconds() + ":tolerance=" + samplingPolicy.toleranceSeconds()
                        + ":effective=" + samplingPolicy.effectiveAt());
                List<Map<String,Object>> signals = jdbc.queryForList("SELECT * FROM iot_alert_signal WHERE device_id=? AND metric_key=? AND rule_source=? AND rule_id=?",
                        deviceId, reading.metricKey(), source, ruleId);
                Map<String,Object> signal = signals.isEmpty() ? null : signals.get(0);
                boolean active = signal != null && tenantId == number(signal.get("tenant_id"))
                        && Boolean.TRUE.equals(signal.get("active")) && fingerprint.equals(signal.get("rule_fingerprint"));
                Long alertId = signal == null ? null : number(signal.get("alert_id"));
                boolean breach = IotMetrics.breaches(rule.get("operator").toString(), reading.value(), new BigDecimal(rule.get("threshold").toString()));
                if (breach && !active) {
                    List<Map<String,Object>> history = jdbc.query("SELECT metric_value,recorded_at FROM iot_telemetry WHERE device_id=? AND metric_key=?",
                            (rs, n) -> { Map<String,Object> row = new HashMap<>(); row.put("value",rs.getBigDecimal("metric_value")); row.put("recordedAt",rs.getString("recorded_at")); return row; },deviceId,reading.metricKey());
                    if (IotAlertRuleRepository.durationSustained(history, at, ((Number)rule.get("durationSeconds")).intValue(),
                            rule.get("operator").toString(), new BigDecimal(rule.get("threshold").toString()),
                            com.agri.iot.support.SamplingPolicy.read((String) device.get("config_text")).policyFor(reading.metricKey()))) {
                        alertId = createAlert(device, reading, rule, at);
                        active = true; created++;
                    }
                } else if (!breach && active) {
                    notify(tenantId,"指标已恢复：" + IotMetrics.metricName(reading.metricKey()),
                            device.get("device_name") + "的" + IotMetrics.metricName(reading.metricKey()) + "已恢复，采样时间" + at
                                    + "，读数" + reading.value() + Objects.toString(reading.unit(), "") + "。关联告警ID：" + alertId
                                    + "；恢复不代表处置完成，请在预警中心核验并结案。", now.format(TIME));
                    active = false; recovered++;
                }
                if (signal == null) {
                    jdbc.update("INSERT INTO iot_alert_signal(device_id,tenant_id,metric_key,rule_source,rule_id,rule_fingerprint,active,alert_id,last_recorded_at) VALUES(?,?,?,?,?,?,?,?,?)",
                            deviceId,tenantId,reading.metricKey(),source,ruleId,fingerprint,active,alertId,at);
                } else {
                    jdbc.update("UPDATE iot_alert_signal SET tenant_id=?,rule_fingerprint=?,active=?,alert_id=?,last_recorded_at=? WHERE device_id=? AND metric_key=? AND rule_source=? AND rule_id=?",
                            tenantId,fingerprint,active,alertId,at,deviceId,reading.metricKey(),source,ruleId);
                }
            }
            // 停用、删除或覆盖的规则退出活动集合，不把规则变化伪装成设备恢复。
            for (Map<String,Object> old : jdbc.queryForList("SELECT rule_source,rule_id FROM iot_alert_signal WHERE device_id=? AND metric_key=? AND active=TRUE",deviceId,reading.metricKey())) {
                if (!retained.contains(old.get("rule_source") + ":" + old.get("rule_id")))
                    jdbc.update("UPDATE iot_alert_signal SET active=FALSE WHERE device_id=? AND metric_key=? AND rule_source=? AND rule_id=?",deviceId,reading.metricKey(),old.get("rule_source"),old.get("rule_id"));
            }
        }
        LocalDateTime last = parse(Objects.toString(device.get("last_report"), ""));
        if (last == null || sampledAt.isAfter(last))
            jdbc.update("UPDATE iot_device SET last_report=?,online_status='online' WHERE id=?",at,deviceId);
        return Map.of("reportId",report.reportId(),"duplicate",false,"readingsSaved",saved,"alertsCreated",created,"recoveries",recovered);
    }

    private long createAlert(Map<String,Object> device, Reading reading, Map<String,Object> rule, String at) {
        String no = "AUTO-" + UUID.randomUUID().toString().replace("-", "");
        String title = "阈值告警：" + IotMetrics.metricName(reading.metricKey());
        String content = device.get("device_name") + "命中规则「" + rule.get("ruleName") + "」：" + reading.value()
                + Objects.toString(reading.unit(), "") + " " + rule.get("operator") + " " + rule.get("threshold")
                + "，持续条件" + rule.get("durationSeconds") + "秒，采样时间" + at
                + "；规则" + rule.get("source") + ":" + rule.get("id") + "。请受理核验后记录实际处置结果。";
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("INSERT INTO iot_alert(alert_no,tenant_id,farm_id,device_id,device_name,alert_type,level_name,title,content,trigger_value,threshold_value,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',?)",Statement.RETURN_GENERATED_KEYS);
            Object[] values = {no,device.get("tenant_id"),device.get("farm_id"),device.get("id"),device.get("device_name"),"threshold",rule.get("level"),title,content,
                    reading.value().toPlainString() + Objects.toString(reading.unit(), ""),rule.get("operator") + " " + rule.get("threshold"),at};
            for (int i=0;i<values.length;i++) statement.setObject(i+1,values[i]);
            return statement;
        },key);
        long id = Objects.requireNonNull(key.getKey()).longValue();
        notify(number(device.get("tenant_id")),title,content + " 告警编号：" + no + "，ID：" + id + "。请进入预警中心处置。", LocalDateTime.now().format(TIME));
        return id;
    }

    private void notify(long tenantId,String title,String content,String at) {
        jdbc.update("INSERT INTO iot_message(tenant_id,message_type,title,content,is_read,created_at) VALUES(?,'alert',?,?,FALSE,?)",tenantId,title,content,at);
    }
    private static Long number(Object value) { return value == null ? null : ((Number)value).longValue(); }
    private static LocalDateTime parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return LocalDateTime.parse(value.trim().replace(' ','T')); } catch (RuntimeException e) { return null; }
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
