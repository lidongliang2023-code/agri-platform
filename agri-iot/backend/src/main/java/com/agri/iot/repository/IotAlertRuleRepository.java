package com.agri.iot.repository;

import com.agri.common.exception.BusinessException;
import com.agri.iot.integration.IotIdentityService;
import com.agri.iot.support.IotMetrics;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 告警阈值规则：平台预置 + 经营主体自定义，以及基于它们的判定。
 *
 * <p>为什么要新增主体维度：上一轮把用户端的「停用/启用平台预置规则」按钮下线了，
 * 因为 {@code iot_alert_rule.enabled} 是全平台开关，任一合作社点一下就会关掉所有人的高温告警。
 * 但下线只解决"不许互相影响"，没解决"蔬菜棚 32℃ 就该通风、苹果园 33℃ 才有日灼风险、
 * 果园还要额外管夜间霜冻"这类真实差异。所以这里：</p>
 * <ul>
 *   <li>平台预置（{@code iot_alert_rule}）对租户<b>只读</b>，作为兜底默认值；</li>
 *   <li>主体自定义（{@code iot_alert_rule_tenant}）按 {@code metric_key}（并在设备类型匹配时）
 *       <b>覆盖</b>平台预置；</li>
 *   <li>判定 {@link #evaluate} / {@link #riskReadings} 只认"当前主体的生效集合"，
 *       所以同一条读数在两个主体下可以得出不同等级——这正是差异化的意义。</li>
 * </ul>
 *
 * <p>{@code duration_seconds} 不是摆设：它回到 {@code iot_telemetry} 的真实读数序列上判定
 * "窗口内每条读数都越线"，窗口里没有读数就不算持续越线（缺数据不等于满足条件）。</p>
 */
@Repository
public class IotAlertRuleRepository {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final int MAX_RULES_PER_TENANT = 50;

    private final JdbcTemplate jdbc;
    private final IotIdentityService identity;

    public IotAlertRuleRepository(JdbcTemplate jdbc, IotIdentityService identity) {
        this.jdbc = jdbc;
        this.identity = identity;
    }

    // ================= 读取 =================

    /** 平台预置阈值（租户侧只读；启停只有运营端能改）。 */
    public List<Map<String, Object>> platformRules() {
        return jdbc.query("SELECT * FROM iot_alert_rule ORDER BY id", (rs, rowNum) -> ruleMap(
                rs.getLong("id"), "platform", rs.getString("rule_name"), rs.getString("device_type"),
                rs.getString("metric_key"), rs.getString("metric_name"), rs.getString("operator_text"),
                decimal(rs.getString("threshold_value")), rs.getInt("duration_seconds"),
                rs.getString("level_name"), rs.getBoolean("enabled"), null, null, null, null));
    }

    /** 当前主体的自定义阈值。 */
    public List<Map<String, Object>> tenantRules() {
        return jdbc.query("SELECT * FROM iot_alert_rule_tenant WHERE tenant_id=? ORDER BY metric_key,id",
                (rs, rowNum) -> ruleMap(
                        rs.getLong("id"), "tenant", rs.getString("rule_name"), rs.getString("device_type"),
                        rs.getString("metric_key"), rs.getString("metric_name"), rs.getString("operator_text"),
                        decimal(rs.getString("threshold_value")), rs.getInt("duration_seconds"),
                        rs.getString("level_name"), rs.getBoolean("enabled"), rs.getString("remark"),
                        rs.getObject("source_rule_id"), rs.getString("created_by"), rs.getString("updated_at")),
                identity.currentTenantId());
    }

    /**
     * 当前主体的生效阈值集合 = 主体自定义（启用） + 未被覆盖的平台预置（启用）。
     *
     * <p>覆盖条件是"同一指标，且主体规则不限设备类型或设备类型相同"。
     * 只有被覆盖的那条平台规则会从判定里退出，其它平台规则继续兜底。</p>
     */
    public List<Map<String, Object>> effectiveRules() {
        List<Map<String, Object>> own = tenantRules().stream()
                .filter(rule -> Boolean.TRUE.equals(rule.get("enabled")))
                .toList();
        List<Map<String, Object>> effective = new ArrayList<>(own);
        for (Map<String, Object> platform : platformRules()) {
            if (!Boolean.TRUE.equals(platform.get("enabled"))) {
                continue;
            }
            Map<String, Object> override = own.stream()
                    .filter(tenant -> sameScope(tenant, platform))
                    .findFirst()
                    .orElse(null);
            if (override != null) {
                platform.put("overridden", Boolean.TRUE);
                platform.put("overriddenByRuleId", override.get("id"));
                platform.put("overriddenByRuleName", override.get("ruleName"));
                continue;
            }
            platform.put("overridden", Boolean.FALSE);
            effective.add(platform);
        }
        return effective;
    }

    /** 给页面用的一份完整视图：平台预置（含"被谁覆盖"）、我的规则、生效集合。 */
    public Map<String, Object> ruleView() {
        List<Map<String, Object>> own = tenantRules();
        List<Map<String, Object>> platform = platformRules();
        Map<Long, Map<String, Object>> ownById = new LinkedHashMap<>();
        own.forEach(rule -> ownById.put(longValue(rule.get("id")), rule));
        for (Map<String, Object> preset : platform) {
            Map<String, Object> override = own.stream()
                    .filter(rule -> Boolean.TRUE.equals(rule.get("enabled")))
                    .filter(rule -> sameScope(rule, preset))
                    .findFirst()
                    .orElse(null);
            preset.put("overridden", override != null);
            preset.put("overriddenByRuleId", override == null ? null : override.get("id"));
            preset.put("overriddenByRuleName", override == null ? null : override.get("ruleName"));
        }
        long tenantId = identity.currentTenantId();
        return map(
                "tenantId", String.valueOf(tenantId),
                "tenantName", scalarOrNull("SELECT tenant_name FROM iot_tenant WHERE id=" + tenantId),
                "platform", platform,
                "tenant", own,
                "effective", effectiveRules(),
                "operatorOptions", IotMetrics.OPERATORS,
                "levelOptions", IotMetrics.LEVELS
        );
    }

    /**
     * 可配置的指标目录：设备类型声明的属性 + 当前主体实际有读数的指标。
     *
     * <p>只给"设备类型里声明过的属性"会让还没装上传器的指标配不了阈值；
     * 只给"读数里出现过的键"又会漏掉刚注册还没上报的设备。两个都取。</p>
     */
    public List<Map<String, Object>> metricOptions() {
        Map<String, List<String>> deviceTypesByKey = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.query(
                "SELECT type_name,property_text FROM iot_device_type WHERE property_text IS NOT NULL AND property_text<>''",
                (rs, rowNum) -> map("type", rs.getString("type_name"), "properties", rs.getString("property_text")))) {
            for (String token : String.valueOf(row.get("properties")).split(",")) {
                String key = token.trim();
                if (key.isEmpty()) {
                    continue;
                }
                List<String> names = deviceTypesByKey.computeIfAbsent(key, ignored -> new ArrayList<>());
                String type = String.valueOf(row.get("type"));
                if (!names.contains(type)) {
                    names.add(type);
                }
            }
        }
        Map<String, String> units = new LinkedHashMap<>();
        List<Object> args = new ArrayList<>();
        String scope = farmScope("t.device_id", args);
        for (Map<String, Object> row : jdbc.query(
                "SELECT DISTINCT t.metric_key metric_key,t.unit_name unit_name FROM iot_telemetry t WHERE 1=1" + scope,
                (rs, rowNum) -> map("key", rs.getString("metric_key"), "unit", rs.getString("unit_name")),
                args.toArray())) {
            units.putIfAbsent(String.valueOf(row.get("key")), String.valueOf(row.get("unit") == null ? "" : row.get("unit")));
        }
        List<Map<String, Object>> options = new ArrayList<>();
        deviceTypesByKey.forEach((key, typeNames) -> options.add(map(
                "key", key,
                "name", IotMetrics.metricName(key),
                "unit", units.getOrDefault(key, ""),
                "deviceTypes", typeNames)));
        units.forEach((key, unit) -> {
            if (!deviceTypesByKey.containsKey(key)) {
                options.add(map("key", key, "name", IotMetrics.metricName(key), "unit", unit, "deviceTypes", List.of()));
            }
        });
        options.sort(Comparator.comparing(row -> String.valueOf(row.get("key"))));
        return options;
    }

    // ================= 写入（主体自定义） =================

    @Transactional
    public Map<String, Object> createTenantRule(Map<String, Object> body) {
        long tenantId = identity.currentTenantId();
        if (count("SELECT COUNT(*) FROM iot_alert_rule_tenant WHERE tenant_id=?", tenantId) >= MAX_RULES_PER_TENANT) {
            throw new IllegalArgumentException("阈值规则最多 " + MAX_RULES_PER_TENANT + " 条，请先删除不再使用的规则");
        }
        NormalizedRule rule = normalize(body);
        String operator = identity.requireOperatorName();
        String now = nowLabel();
        try {
            jdbc.update("""
                    INSERT INTO iot_alert_rule_tenant
                    (tenant_id,rule_name,device_type,metric_key,metric_name,operator_text,threshold_value,
                     duration_seconds,level_name,enabled,remark,source_rule_id,created_by,updated_by,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """, tenantId, rule.ruleName(), rule.deviceType(), rule.metricKey(), rule.metricName(),
                    rule.operator(), rule.thresholdText(), rule.durationSeconds(), rule.level(), rule.enabled(),
                    rule.remark(), rule.sourceRuleId(), operator, operator, now, now);
        } catch (DuplicateKeyException exception) {
            throw BusinessException.exists("阈值规则已存在，请修改现有规则而不是重复新建");
        }
        // 按刚写入的内容回捞主键：比"取本租户最大 id"稳（并发建规则时后者会拿到别人的行）
        Long insertedId = jdbc.queryForObject("""
                SELECT MAX(id) FROM iot_alert_rule_tenant
                WHERE tenant_id=? AND rule_name=? AND metric_key=? AND operator_text=? AND threshold_value=?
                """, Long.class, tenantId, rule.ruleName(), rule.metricKey(), rule.operator(), rule.thresholdText());
        addLog("新增阈值规则", rule.ruleName(),
                rule.metricName() + " " + rule.operator() + " " + rule.thresholdText() + " " + rule.level());
        return requireTenantRule(insertedId == null ? 0 : insertedId);
    }

    @Transactional
    public Map<String, Object> updateTenantRule(long id, Map<String, Object> body) {
        Map<String, Object> existing = requireTenantRule(id);
        NormalizedRule rule = normalize(body);
        String operator = identity.requireOperatorName();
        jdbc.update("""
                UPDATE iot_alert_rule_tenant
                SET rule_name=?,device_type=?,metric_key=?,metric_name=?,operator_text=?,threshold_value=?,
                    duration_seconds=?,level_name=?,enabled=?,remark=?,source_rule_id=?,updated_by=?,updated_at=?
                WHERE id=?
                """, rule.ruleName(), rule.deviceType(), rule.metricKey(), rule.metricName(), rule.operator(),
                rule.thresholdText(), rule.durationSeconds(), rule.level(), rule.enabled(), rule.remark(),
                rule.sourceRuleId(), operator, nowLabel(), id);
        addLog("编辑阈值规则", String.valueOf(existing.get("ruleName")),
                rule.metricName() + " " + rule.operator() + " " + rule.thresholdText() + " " + rule.level());
        return requireTenantRule(id);
    }

    @Transactional
    public Map<String, Object> deleteTenantRule(long id) {
        Map<String, Object> rule = requireTenantRule(id);
        jdbc.update("DELETE FROM iot_alert_rule_tenant WHERE id=?", id);
        addLog("删除阈值规则", String.valueOf(rule.get("ruleName")),
                String.valueOf(rule.get("metricName")) + " 阈值已删除，该指标回落到平台预置");
        return map("id", id, "ruleName", rule.get("ruleName"));
    }

    @Transactional
    public Map<String, Object> toggleTenantRule(long id) {
        Map<String, Object> existing = requireTenantRule(id);
        boolean enabled = !Boolean.TRUE.equals(existing.get("enabled"));
        jdbc.update("UPDATE iot_alert_rule_tenant SET enabled=?,updated_by=?,updated_at=? WHERE id=?",
                enabled, identity.requireOperatorName(), nowLabel(), id);
        addLog((enabled ? "启用" : "停用") + "阈值规则", String.valueOf(existing.get("ruleName")),
                enabled ? "停用后该指标回落到平台预置阈值" : "按本主体阈值判定");
        return requireTenantRule(id);
    }

    // ================= 平台预置治理（运营端） =================

    /** 运营端启停平台预置：这是全平台开关，所以只有运营能做，并且要留痕。 */
    @Transactional
    public Map<String, Object> togglePlatformRule(long id) {
        Map<String, Object> rule = platformRules().stream()
                .filter(item -> longValue(item.get("id")) == id)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("平台阈值规则不存在：" + id));
        boolean enabled = !Boolean.TRUE.equals(rule.get("enabled"));
        jdbc.update("UPDATE iot_alert_rule SET enabled=? WHERE id=?", enabled, id);
        addLog((enabled ? "启用" : "停用") + "平台阈值规则", String.valueOf(rule.get("ruleName")),
                "全平台生效范围，操作人取令牌账号");
        return platformRules().stream()
                .filter(item -> longValue(item.get("id")) == id)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("平台阈值规则不存在：" + id));
    }

    /** 运营端：各主体自定义阈值一览（带主体名），用于治理与排查"为什么这家报警那家不报"。 */
    public List<Map<String, Object>> allTenantRules() {
        return jdbc.query("""
                SELECT r.*,t.tenant_name FROM iot_alert_rule_tenant r
                LEFT JOIN iot_tenant t ON t.id=r.tenant_id
                ORDER BY r.tenant_id,r.metric_key,r.id
                """, (rs, rowNum) -> {
            Map<String, Object> rule = ruleMap(
                    rs.getLong("id"), "tenant", rs.getString("rule_name"), rs.getString("device_type"),
                    rs.getString("metric_key"), rs.getString("metric_name"), rs.getString("operator_text"),
                    decimal(rs.getString("threshold_value")), rs.getInt("duration_seconds"),
                    rs.getString("level_name"), rs.getBoolean("enabled"), rs.getString("remark"),
                    rs.getObject("source_rule_id"), rs.getString("created_by"), rs.getString("updated_at"));
            rule.put("tenantId", String.valueOf(rs.getLong("tenant_id")));
            rule.put("tenantName", rs.getString("tenant_name"));
            return rule;
        });
    }

    /** 设备类型目录（规则可以限定到某一类设备，也可以不限）。 */
    public List<String> deviceTypeNames() {
        return jdbc.queryForList("SELECT type_name FROM iot_device_type ORDER BY id", String.class);
    }

    // ================= 判定 =================

    /**
     * 阈值试算：给一个读数，按<b>当前主体</b>的生效规则判定等级。
     *
     * <p>这是采集/接入侧将来落地时应该调用的判据入口：平台目前没有到设备的链路，
     * 所以读数不会自动进来，但"这条读数在本主体的阈值下算不算越线、算几级"现在就是可算的。</p>
     */
    public Map<String, Object> evaluate(Map<String, Object> body) {
        String metricKey = required(body, "metricKey", "请选择要试算的指标");
        BigDecimal value = decimal(body.get("value"));
        if (value == null) {
            throw new IllegalArgumentException("读数必须是数字");
        }
        String deviceType = blankToNull(text(body, "deviceType", ""));
        List<Map<String, Object>> hits = effectiveRules().stream()
                .filter(rule -> matches(rule, metricKey, deviceType))
                .filter(rule -> IotMetrics.breaches(String.valueOf(rule.get("operator")),
                        value, decimal(rule.get("threshold"))))
                .sorted(Comparator.comparingInt(rule -> IotMetrics.levelRank(String.valueOf(rule.get("level")))))
                .toList();
        String level = hits.isEmpty() ? "normal" : String.valueOf(hits.get(0).get("level"));
        return map(
                "metricKey", metricKey,
                "metricName", IotMetrics.metricName(metricKey),
                "deviceType", deviceType,
                "value", value,
                "level", level,
                "levelName", levelNameCn(level),
                "breached", !hits.isEmpty(),
                "matchedRules", hits,
                "note", hits.isEmpty()
                        ? "按当前经营主体生效阈值，该读数未越线"
                        : "命中 " + hits.size() + " 条规则，最高等级「" + levelNameCn(level)
                                + "」。这里是瞬时判定；带持续时间的规则要按读数序列判，请看风险读数清单。",
                "evaluatedAt", nowLabel()
        );
    }

    /**
     * 风险读数清单：当前主体设备里，最近一次读数已经越过本主体生效阈值的指标。
     *
     * <p>带 {@code duration_seconds} 的规则用真实读数序列判定"窗口内是否持续越线"，
     * 窗口里没有读数就不算满足（缺数据不等于条件成立）。没有命中任何规则的指标不出现在结果里。</p>
     */
    public List<Map<String, Object>> riskReadings() {
        List<Map<String, Object>> rules = effectiveRules();
        if (rules.isEmpty()) {
            return List.of();
        }
        List<Object> latestArgs = new ArrayList<>();
        String latestScope = farmScope("d.farm_id", latestArgs);
        List<Map<String, Object>> latest = jdbc.query("""
                SELECT device_id,device_name,device_code,type_name,metric_key,metric_value,unit_name,recorded_at
                FROM (
                    SELECT d.id device_id,d.device_name,d.device_code,d.type_name,
                           t.metric_key,t.metric_value,t.unit_name,t.recorded_at,
                           ROW_NUMBER() OVER (PARTITION BY t.device_id,t.metric_key ORDER BY t.recorded_at DESC,t.id DESC) rn
                    FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id
                    WHERE 1=1""" + latestScope + """
                ) x WHERE x.rn=1
                """, (rs, rowNum) -> map(
                "deviceId", rs.getLong("device_id"),
                "deviceName", rs.getString("device_name"),
                "deviceCode", rs.getString("device_code"),
                "typeName", rs.getString("type_name"),
                "metricKey", rs.getString("metric_key"),
                "value", rs.getBigDecimal("metric_value"),
                "unit", rs.getString("unit_name"),
                "recordedAt", rs.getString("recorded_at")), latestArgs.toArray());
        if (latest.isEmpty()) {
            return List.of();
        }
        List<Object> historyArgs = new ArrayList<>();
        String historyScope = farmScope("d.farm_id", historyArgs);
        Map<String, List<Map<String, Object>>> history = new LinkedHashMap<>();
        jdbc.query("""
                SELECT t.device_id,d.type_name,t.metric_key,t.metric_value,t.recorded_at
                FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id
                WHERE 1=1""" + historyScope + """
                 ORDER BY t.device_id,t.metric_key,t.recorded_at,t.id
                """, rs -> {
            String key = rs.getLong("device_id") + "|" + rs.getString("metric_key");
            history.computeIfAbsent(key, ignored -> new ArrayList<>()).add(map(
                    "value", rs.getBigDecimal("metric_value"),
                    "recordedAt", rs.getString("recorded_at"),
                    "typeName", rs.getString("type_name")));
        }, historyArgs.toArray());

        List<Map<String, Object>> risks = new ArrayList<>();
        for (Map<String, Object> row : latest) {
            String metricKey = String.valueOf(row.get("metricKey"));
            BigDecimal value = (BigDecimal) row.get("value");
            String typeName = String.valueOf(row.get("typeName"));
            for (Map<String, Object> rule : rules) {
                if (!matches(rule, metricKey, typeName)) {
                    continue;
                }
                if (!IotMetrics.breaches(String.valueOf(rule.get("operator")), value, decimal(rule.get("threshold")))) {
                    continue;
                }
                int duration = (int) longValue(rule.get("durationSeconds"));
                Boolean sustained = durationSustained(
                        history.get(row.get("deviceId") + "|" + metricKey),
                        String.valueOf(row.get("recordedAt")),
                        duration,
                        String.valueOf(rule.get("operator")),
                        decimal(rule.get("threshold")));
                if (duration > 0 && Boolean.FALSE.equals(sustained)) {
                    // 写了持续时间却没满足：瞬时越线可以提示，但不能当成"已满足条件的风险读数"
                    continue;
                }
                risks.add(map(
                        "deviceId", row.get("deviceId"),
                        "deviceName", row.get("deviceName"),
                        "deviceCode", row.get("deviceCode"),
                        "typeName", typeName,
                        "metricKey", metricKey,
                        "metricName", rule.get("metricName") == null || String.valueOf(rule.get("metricName")).isBlank()
                                ? IotMetrics.metricName(metricKey) : rule.get("metricName"),
                        "value", value,
                        "unit", row.get("unit"),
                        "recordedAt", row.get("recordedAt"),
                        "operator", rule.get("operator"),
                        "threshold", rule.get("threshold"),
                        "durationSeconds", duration,
                        "sustained", duration == 0 ? null : sustained,
                        "level", rule.get("level"),
                        "ruleId", rule.get("id"),
                        "ruleName", rule.get("ruleName"),
                        "ruleSource", rule.get("source")));
            }
        }
        risks.sort(Comparator
                .comparingInt((Map<String, Object> row) -> IotMetrics.levelRank(String.valueOf(row.get("level"))))
                .thenComparing(row -> String.valueOf(row.get("recordedAt")), Comparator.reverseOrder()));
        return risks;
    }

    /** 环境卡片用的单值判级：命中生效规则就按规则等级，否则 normal。 */
    public String judgeLevel(String metricKey, BigDecimal value, List<Map<String, Object>> rules) {
        if (value == null) {
            return "normal";
        }
        return rules.stream()
                .filter(rule -> matches(rule, metricKey, null))
                .filter(rule -> IotMetrics.breaches(String.valueOf(rule.get("operator")), value, decimal(rule.get("threshold"))))
                .min(Comparator.comparingInt(rule -> IotMetrics.levelRank(String.valueOf(rule.get("level")))))
                .map(rule -> String.valueOf(rule.get("level")))
                .orElse("normal");
    }

    // ================= 内部 =================

    private Boolean durationSustained(List<Map<String, Object>> readings, String latestRecordedAt,
                                      int durationSeconds, String operator, BigDecimal threshold) {
        if (durationSeconds <= 0) {
            return Boolean.TRUE;
        }
        if (readings == null || readings.isEmpty()) {
            return Boolean.FALSE;
        }
        LocalDateTime latest = parseTime(latestRecordedAt);
        if (latest == null) {
            return null;
        }
        String windowStart = latest.minusSeconds(durationSeconds).format(TIME);
        List<Map<String, Object>> inWindow = readings.stream()
                .filter(row -> String.valueOf(row.get("recordedAt")).compareTo(windowStart) > 0)
                .toList();
        if (inWindow.isEmpty()) {
            return Boolean.FALSE;
        }
        boolean allBreach = inWindow.stream().allMatch(row ->
                IotMetrics.breaches(operator, (BigDecimal) row.get("value"), threshold));
        return allBreach ? Boolean.TRUE : Boolean.FALSE;
    }

    private boolean sameScope(Map<String, Object> tenantRule, Map<String, Object> platformRule) {
        if (!String.valueOf(tenantRule.get("metricKey")).equals(String.valueOf(platformRule.get("metricKey")))) {
            return false;
        }
        String tenantType = blankToNull(String.valueOf(tenantRule.get("deviceType") == null
                ? "" : tenantRule.get("deviceType")));
        if (tenantType == null) {
            return true;
        }
        String platformType = blankToNull(String.valueOf(platformRule.get("deviceType") == null
                ? "" : platformRule.get("deviceType")));
        return platformType == null || platformType.equals(tenantType);
    }

    private boolean matches(Map<String, Object> rule, String metricKey, String deviceType) {
        if (!metricKey.equals(String.valueOf(rule.get("metricKey")))) {
            return false;
        }
        String ruleType = blankToNull(rule.get("deviceType") == null ? "" : String.valueOf(rule.get("deviceType")));
        if (ruleType == null) {
            return true;
        }
        return deviceType == null || deviceType.isBlank() || ruleType.equals(deviceType);
    }

    private Map<String, Object> requireTenantRule(long id) {
        identity.requireTenantRow("iot_alert_rule_tenant", id, "阈值规则");
        return tenantRules().stream()
                .filter(rule -> longValue(rule.get("id")) == id)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("阈值规则不存在：" + id));
    }

    /** 规则内容校验并归一化；单位、名称这些展示字段一律由服务端按指标目录补，不接受前端自报。 */
    private NormalizedRule normalize(Map<String, Object> body) {
        String ruleName = required(body, "ruleName", "请输入规则名称");
        if (ruleName.length() > 160) {
            throw new IllegalArgumentException("规则名称不能超过 160 个字符");
        }
        String metricKey = required(body, "metricKey", "请选择监控指标");
        if (metricKey.length() > 40) {
            throw new IllegalArgumentException("指标标识过长");
        }
        String operator = text(body, "operator", "");
        if (!IotMetrics.OPERATORS.contains(operator)) {
            throw new IllegalArgumentException("比较方式只能是 " + String.join(" / ", IotMetrics.OPERATORS));
        }
        BigDecimal threshold = decimal(body.get("threshold"));
        if (threshold == null) {
            throw new IllegalArgumentException("阈值必须是数字");
        }
        String level = text(body, "level", "major");
        if (!IotMetrics.LEVELS.contains(level)) {
            throw new IllegalArgumentException("告警等级只能是 " + String.join(" / ", IotMetrics.LEVELS));
        }
        long duration = longValue(body.get("durationSeconds"));
        if (duration < 0 || duration > 86400) {
            throw new IllegalArgumentException("持续时间需要在 0~86400 秒之间");
        }
        String deviceType = blankToNull(text(body, "deviceType", ""));
        if (deviceType != null && !deviceTypeNames().contains(deviceType)) {
            throw new IllegalArgumentException("设备类型「" + deviceType + "」不在物联网设备类型目录里");
        }
        String remark = text(body, "remark", "");
        if (remark.length() > 400) {
            throw new IllegalArgumentException("备注不能超过 400 个字符");
        }
        Long sourceRuleId = longObject(body.get("sourceRuleId"));
        if (sourceRuleId != null) {
            boolean presetExists = platformRules().stream().anyMatch(rule -> longValue(rule.get("id")) == sourceRuleId);
            if (!presetExists) {
                throw new IllegalArgumentException("来源平台规则不存在：" + sourceRuleId);
            }
        }
        return new NormalizedRule(ruleName, deviceType, metricKey, IotMetrics.metricName(metricKey),
                operator, threshold.stripTrailingZeros().toPlainString(), (int) duration, level,
                body.get("enabled") == null || Boolean.TRUE.equals(body.get("enabled")),
                remark.isBlank() ? null : remark, sourceRuleId);
    }

    private String farmScope(String column, List<Object> args) {
        List<Long> farmIds = identity.currentFarmIds();
        if (farmIds.isEmpty()) {
            return " AND 1=0";
        }
        args.addAll(farmIds);
        return " AND " + column + " IN (" + identity.farmPlaceholders(farmIds) + ")";
    }

    private Map<String, Object> ruleMap(long id, String source, String ruleName, String deviceType,
                                        String metricKey, String metricName, String operator, BigDecimal threshold,
                                        int durationSeconds, String level, boolean enabled, String remark,
                                        Object sourceRuleId, String createdBy, String updatedAt) {
        return map(
                "id", id,
                "source", source,
                "ruleName", ruleName,
                "deviceType", deviceType,
                "metricKey", metricKey,
                "metricName", metricName == null || metricName.isBlank()
                        ? IotMetrics.metricName(metricKey) : metricName,
                "operator", operator,
                "threshold", threshold,
                "durationSeconds", durationSeconds,
                "level", level,
                "enabled", enabled,
                "remark", remark,
                "sourceRuleId", sourceRuleId,
                "createdBy", createdBy,
                "updatedAt", updatedAt,
                "overridden", Boolean.FALSE);
    }

    private static String levelNameCn(String level) {
        return switch (level == null ? "" : level) {
            case "critical" -> "紧急";
            case "major" -> "重要";
            case "normal" -> "一般";
            default -> level;
        };
    }

    private static LocalDateTime parseTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(raw.trim(), TIME);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() || "null".equals(value) ? null : value.trim();
    }

    private String scalarOrNull(String sql) {
        List<String> values = jdbc.queryForList(sql, String.class);
        return values.isEmpty() ? null : values.get(0);
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private static BigDecimal decimal(Object value) {
        if (value == null || String.valueOf(value).isBlank() || "null".equals(String.valueOf(value))) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static long longValue(Object value) {
        Long parsed = longObject(value);
        return parsed == null ? 0 : parsed;
    }

    private static Long longObject(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return value == null || String.valueOf(value).isBlank() ? null : Long.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }

    private String nowLabel() {
        return LocalDateTime.now().format(TIME);
    }

    private void addLog(String action, String target, String detail) {
        jdbc.update("""
                INSERT INTO iot_ops_log (operator_name,action_name,target_name,detail_text,ip_address,created_at)
                VALUES (?,?,?,?,?,?)
                """, identity.requireOperatorName(), action, target, detail, identity.clientIp(), nowLabel());
    }

    private record NormalizedRule(String ruleName, String deviceType, String metricKey, String metricName,
                                  String operator, String thresholdText, int durationSeconds, String level,
                                  boolean enabled, String remark, Long sourceRuleId) {
    }
}
