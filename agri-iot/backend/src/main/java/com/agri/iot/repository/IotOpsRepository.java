package com.agri.iot.repository;

import com.agri.common.exception.BusinessException;
import com.agri.iot.integration.IotIdentityService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class IotOpsRepository {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private final JdbcTemplate jdbc;
    private final IotIdentityService identity;

    public IotOpsRepository(JdbcTemplate jdbc, IotIdentityService identity) {
        this.jdbc = jdbc;
        this.identity = identity;
    }

    public Map<String, Object> overview() {
        long devices = number("SELECT COUNT(*) FROM iot_device");
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("tenants", number("SELECT COUNT(*) FROM iot_tenant"));
        metrics.put("devices", devices);
        metrics.put("online", number("SELECT COUNT(*) FROM iot_device WHERE online_status='online'"));
        metrics.put("offline", number("SELECT COUNT(*) FROM iot_device WHERE online_status='offline'"));
        metrics.put("openAlerts", number("SELECT COUNT(*) FROM iot_alert WHERE status<>'resolved'"));
        metrics.put("gateways", number("SELECT COUNT(*) FROM iot_gateway"));
        // 8562 / 520000 是写在代码里的常量：全平台一天控制多少次、吞吐多少，
        // 跟库里有没有这些记录无关。现在按控制日志与遥测读数实查（时间列统一 yyyy-MM-dd HH:mm）。
        metrics.put("todayControls", number(
                "SELECT COUNT(*) FROM iot_control_log WHERE created_at LIKE ?", todayPrefix() + "%"));
        metrics.put("throughput", number(
                "SELECT COUNT(*) FROM iot_telemetry WHERE recorded_at LIKE ?", todayPrefix() + "%"));
        metrics.put("pendingAccess", number("SELECT COUNT(*) FROM iot_access_audit WHERE status='pending'"));
        metrics.put("dataPoints", number("SELECT COUNT(*) FROM iot_telemetry"));
        return Map.of(
                "metrics", metrics,
                "tenants", tenants(),
                "devices", devices(null, null).stream().limit(10).toList(),
                "alerts", alerts().stream().limit(5).toList(),
                "gateways", gateways(),
                "onlineTrend", onlineTrend(devices),
                "typeDistribution", jdbc.query("""
                        SELECT t.category_name name,COUNT(d.id) value FROM iot_device_type t
                        LEFT JOIN iot_device d ON d.type_id=t.id GROUP BY t.category_name ORDER BY value DESC
                        """, (rs, rowNum) -> Map.of("name", rs.getString("name"), "value", rs.getLong("value")))
        );
    }

    private String todayPrefix() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    }

    /**
     * 近 7 个有上报日期的「设备上报覆盖率」。
     *
     * <p>以前这里返回一条写死的曲线（94.1、94.4…），平台没有任何在线率历史表，
     * 运营端却拿它当趋势看。改成实算：每个日期里"当天有遥测读数的设备数 / 在册设备数"，
     * 没有读数记录时返回空列表，图表为空而不是假曲线。</p>
     */
    private List<Double> onlineTrend(long deviceTotal) {
        if (deviceTotal <= 0) {
            return List.of();
        }
        List<Double> trend = jdbc.queryForList("""
                SELECT ROUND(COUNT(DISTINCT device_id) * 100.0 / ?,1) rate
                FROM (
                    SELECT device_id,SUBSTRING(recorded_at,1,10) day FROM iot_telemetry
                    GROUP BY device_id,SUBSTRING(recorded_at,1,10)
                ) recent
                GROUP BY day ORDER BY day DESC LIMIT 7
                """, Double.class, deviceTotal);
        java.util.Collections.reverse(trend);
        return trend;
    }

    public List<Map<String, Object>> tenants() {
        // device_count 是表里的存量列，注册/删除设备并不维护它，运营端拿它做配额判断会一直偏小；
        // 这里按设备台账实时算，存量列只作为历史参考不再输出。
        return jdbc.query("""
                SELECT t.*, (SELECT COUNT(*) FROM iot_device d WHERE d.tenant_id=t.id) actual_device_count
                FROM iot_tenant t ORDER BY actual_device_count DESC
                """, (rs, rowNum) -> map(
                "id", rs.getLong("id"), "tenantName", rs.getString("tenant_name"), "tenantCode", rs.getString("tenant_code"),
                "planName", rs.getString("plan_name"), "deviceLimit", rs.getInt("device_limit"),
                "deviceCount", rs.getLong("actual_device_count"), "region", rs.getString("region_name"),
                "status", rs.getString("status"), "expireDate", rs.getString("expire_date")));
    }

    /** 配额调整：范围校验 + 租户必须存在 + 操作人取令牌账号。 */
    public Map<String, Object> updateTenantQuota(long id, Map<String, Object> body) {
        int limit = intValue(body.get("deviceLimit"), -1);
        if (limit < 1 || limit > 100000) {
            throw new IllegalArgumentException("设备上限需要填 1~100000 之间的整数");
        }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM iot_tenant WHERE id=?", Integer.class, id) == 0) {
            throw BusinessException.notFound("租户不存在：" + id);
        }
        long used = number("SELECT COUNT(*) FROM iot_device WHERE tenant_id=?", id);
        if (limit < used) {
            throw new IllegalArgumentException("设备上限不能低于该租户已接入设备数（" + used + " 台）");
        }
        jdbc.update("UPDATE iot_tenant SET device_limit=? WHERE id=?", limit, id);
        addLog("调整租户配额", "TENANT-" + id, "设备上限调整为 " + limit);
        return tenants().stream().filter(t -> longValue(t.get("id")) == id).findFirst()
                .orElseThrow(() -> BusinessException.notFound("租户不存在：" + id));
    }

    public List<Map<String, Object>> devices(String keyword, String status) {
        StringBuilder sql = new StringBuilder("SELECT d.*,t.tenant_name,f.farm_name FROM iot_device d LEFT JOIN iot_tenant t ON t.id=d.tenant_id LEFT JOIN iot_farm f ON f.id=d.farm_id WHERE 1=1");
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(d.device_name) LIKE ? OR LOWER(d.device_code) LIKE ?)");
            String like = "%" + keyword.toLowerCase() + "%";
            args.add(like);
            args.add(like);
        }
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND d.online_status=?");
            args.add(status);
        }
        sql.append(" ORDER BY CASE d.online_status WHEN 'alert' THEN 0 WHEN 'offline' THEN 1 ELSE 2 END,d.id");
        return jdbc.query(sql.toString(), (rs, rowNum) -> map(
                "id", rs.getLong("id"), "tenantName", rs.getString("tenant_name"), "farmName", rs.getString("farm_name"),
                "deviceCode", rs.getString("device_code"), "deviceName", rs.getString("device_name"),
                "typeName", rs.getString("type_name"), "protocol", rs.getString("protocol_name"),
                "onlineStatus", rs.getString("online_status"), "lastReport", rs.getString("last_report"),
                "rssi", rs.getObject("signal_strength"), "battery", rs.getInt("battery_rate"),
                "firmwareVersion", rs.getString("firmware_version")), args.toArray());
    }

    public List<Map<String, Object>> gateways() {
        return jdbc.query("""
                SELECT g.*,f.farm_name FROM iot_gateway g LEFT JOIN iot_farm f ON f.id=g.farm_id
                ORDER BY g.online_status DESC,g.id
                """, (rs, rowNum) -> map(
                "id", rs.getLong("id"), "farmName", rs.getString("farm_name"), "gatewayCode", rs.getString("gateway_code"),
                "gatewayName", rs.getString("gateway_name"), "model", rs.getString("gateway_model"),
                "protocol", rs.getString("protocol_name"), "firmwareVersion", rs.getString("firmware_version"),
                "onlineCount", rs.getInt("online_count"), "totalCount", rs.getInt("total_count"),
                "onlineStatus", rs.getString("online_status"), "cpuRate", rs.getBigDecimal("cpu_rate"),
                "memoryRate", rs.getBigDecimal("memory_rate"), "lastOnline", rs.getString("last_online")));
    }

    /**
     * 远程重启网关。
     *
     * <p>以前不管网关实际是什么状态，都会把 {@code last_online} 写成固定串
     * "今天 10:22（远程重启）"并回一句"重启指令执行成功"。平台没有到网关的下发链路，
     * 现在只留一条"指令已下发"的留痕（带真实时间），状态仍由网关心跳决定。</p>
     */
    public Map<String, Object> restartGateway(long id) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM iot_gateway WHERE id=?", Integer.class, id) == 0) {
            throw BusinessException.notFound("边缘网关不存在：" + id);
        }
        jdbc.update("UPDATE iot_gateway SET last_online=? WHERE id=?", nowLabel() + "（重启指令已下发）", id);
        addLog("远程重启网关", "GW-" + id, "重启指令已下发，等待网关心跳回传");
        return Map.of("id", id, "result", "queued", "message", "网关重启指令已下发，状态以上线心跳为准");
    }

    public List<Map<String, Object>> alerts() {
        return jdbc.query("""
                SELECT a.*,t.tenant_name FROM iot_alert a LEFT JOIN iot_tenant t ON t.id=a.tenant_id
                ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'handling' THEN 1 ELSE 2 END,a.id DESC
                """, (rs, rowNum) -> map(
                "id", rs.getLong("id"), "alertNo", rs.getString("alert_no"), "tenantName", rs.getString("tenant_name"),
                "deviceName", rs.getString("device_name"), "type", rs.getString("alert_type"),
                "level", rs.getString("level_name"), "title", rs.getString("title"), "content", rs.getString("content"),
                "status", rs.getString("status"), "handledBy", rs.getString("handled_by"),
                "handleNote", rs.getString("handle_note"), "createdAt", rs.getString("created_at")));
    }

    public Map<String, Object> handleAlert(long id, Map<String, Object> body) {
        String status = text(body, "status", "resolved");
        if (!List.of("pending", "handling", "resolved").contains(status)) {
            throw new IllegalArgumentException("告警状态只能是待处理、处理中或已恢复");
        }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM iot_alert WHERE id=?", Integer.class, id) == 0) {
            throw BusinessException.notFound("告警不存在：" + id);
        }
        String operator = identity.requireOperatorName();
        jdbc.update("""
                UPDATE iot_alert SET status=?,handled_by=?,handle_note=?,handled_at=? WHERE id=?
                """, status, operator, required(body, "note", "请填写处置说明"), nowLabel(), id);
        addLog("告警运营处置", "ALERT-" + id, status + " · " + text(body, "note", ""));
        return alerts().stream().filter(a -> longValue(a.get("id")) == id).findFirst()
                .orElseThrow(() -> BusinessException.notFound("告警不存在：" + id));
    }

    public List<Map<String, Object>> products() {
        return jdbc.query("SELECT * FROM iot_product ORDER BY id", (rs, rowNum) -> map(
                "id", rs.getLong("id"), "productName", rs.getString("product_name"),
                "productKey", rs.getString("product_key"), "category", rs.getString("category_name"),
                "protocol", rs.getString("protocol_name"), "model", rs.getString("model_name"),
                "propertyCount", rs.getInt("property_count"), "deviceCount", rs.getInt("device_count"),
                "status", rs.getString("status")));
    }

    public List<Map<String, Object>> protocols() {
        return jdbc.query("SELECT * FROM iot_protocol ORDER BY id", (rs, rowNum) -> map(
                "id", rs.getLong("id"), "protocolName", rs.getString("protocol_name"),
                "protocolType", rs.getString("protocol_type"), "endpoint", rs.getString("endpoint_text"),
                "port", rs.getString("port_text"), "status", rs.getString("status"),
                "connections", rs.getInt("connections")));
    }

    public List<Map<String, Object>> accessAudits() {
        return jdbc.query("""
                SELECT * FROM iot_access_audit
                ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC
                """, (rs, rowNum) -> map(
                "id", rs.getLong("id"), "deviceCode", rs.getString("device_code"),
                "deviceName", rs.getString("device_name"), "tenantName", rs.getString("tenant_name"),
                "requestType", rs.getString("request_type"), "status", rs.getString("status"),
                "submittedAt", rs.getString("submitted_at"), "auditor", rs.getString("auditor"),
                "note", rs.getString("note")));
    }

    /**
     * 接入审核。
     *
     * <p>审核人以前固定写"张运营"，谁点都是他；现在取令牌账号，
     * 并且只允许 approved/rejected 两种结论，避免把状态字段写成任意文本。</p>
     */
    public Map<String, Object> reviewAccess(long id, Map<String, Object> body) {
        String status = text(body, "status", "approved");
        if (!List.of("approved", "rejected").contains(status)) {
            throw new IllegalArgumentException("接入审核结论只能是通过或驳回");
        }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM iot_access_audit WHERE id=?", Integer.class, id) == 0) {
            throw BusinessException.notFound("接入申请不存在：" + id);
        }
        jdbc.update("""
                UPDATE iot_access_audit SET status=?,auditor=?,note=? WHERE id=?
                """, status, identity.requireOperatorName(),
                required(body, "note", "请填写审核意见"), id);
        addLog("设备接入审核", "ACCESS-" + id, status + " · " + text(body, "note", ""));
        return accessAudits().stream().filter(a -> longValue(a.get("id")) == id).findFirst()
                .orElseThrow(() -> BusinessException.notFound("接入申请不存在：" + id));
    }

    public List<Map<String, Object>> otaTasks() {
        return jdbc.query("""
                SELECT o.*,t.tenant_name FROM iot_ota_task o LEFT JOIN iot_tenant t ON t.id=o.tenant_id
                ORDER BY o.id DESC
                """, (rs, rowNum) -> map(
                "id", rs.getLong("id"), "taskNo", rs.getString("task_no"),
                "tenantName", rs.getString("tenant_name"),
                "firmwareVersion", rs.getString("firmware_version"), "targetCount", rs.getInt("target_count"),
                "successCount", rs.getInt("success_count"), "failedCount", rs.getInt("failed_count"),
                "targetScope", rs.getString("target_scope"), "status", rs.getString("status"),
                "executeWindow", rs.getString("execute_window"), "createdAt", rs.getString("created_at")));
    }

    /**
     * 执行 OTA 任务。
     *
     * <p>平台没有到网关/设备的固件下发与回执链路，以前点一次就把状态写成 running 并记
     * "已进入执行队列"，运营看到的"执行中"其实是点击动作本身造出来的。
     * 现在不改状态：留一条排期留痕，返回里明确说明要等设备上线回执后才回写进度。</p>
     */
    public Map<String, Object> executeOta(long id) {
        Map<String, Object> task = otaTasks().stream()
                .filter(o -> longValue(o.get("id")) == id)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("升级任务不存在：" + id));
        if ("completed".equals(task.get("status"))) {
            throw new IllegalArgumentException("该任务已完成，无需重复执行");
        }
        addLog("排期OTA任务", String.valueOf(task.get("taskNo")),
                "执行窗口 " + task.get("executeWindow") + "，等待网关拉取固件后回写进度");
        Map<String, Object> result = new LinkedHashMap<>(task);
        result.put("message", "任务已排入执行窗口 " + task.get("executeWindow")
                + "；升级进度需网关回执后回写，当前不改标记为执行中");
        return result;
    }

    public List<Map<String, Object>> workOrders() {
        return jdbc.query("""
                SELECT w.*,t.tenant_name FROM iot_work_order w LEFT JOIN iot_tenant t ON t.id=w.tenant_id
                ORDER BY CASE w.status WHEN 'completed' THEN 1 ELSE 0 END,w.id DESC
                """, (rs, rowNum) -> map(
                "id", rs.getLong("id"), "orderNo", rs.getString("order_no"), "source", rs.getString("source_name"),
                "tenantName", rs.getString("tenant_name"),
                "deviceName", rs.getString("device_name"), "type", rs.getString("order_type"),
                "priority", rs.getString("priority"), "status", rs.getString("status"),
                "technician", rs.getString("technician"), "description", rs.getString("description"),
                "createdAt", rs.getString("created_at")));
    }

    public List<Map<String, Object>> logs() {
        return jdbc.query("SELECT * FROM iot_ops_log ORDER BY id DESC", (rs, rowNum) -> map(
                "id", rs.getLong("id"), "operator", rs.getString("operator_name"),
                "action", rs.getString("action_name"), "target", rs.getString("target_name"),
                "detail", rs.getString("detail_text"), "ip", rs.getString("ip_address"),
                "createdAt", rs.getString("created_at")));
    }

    public Map<String, Object> reports() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("tenants", number("SELECT COUNT(*) FROM iot_tenant"));
        metrics.put("devices", number("SELECT COUNT(*) FROM iot_device"));
        metrics.put("online", number("SELECT COUNT(*) FROM iot_device WHERE online_status='online'"));
        metrics.put("alerts", number("SELECT COUNT(*) FROM iot_alert"));
        metrics.put("openAlerts", number("SELECT COUNT(*) FROM iot_alert WHERE status<>'resolved'"));
        metrics.put("workOrders", number("SELECT COUNT(*) FROM iot_work_order"));
        metrics.put("openWorkOrders", number("SELECT COUNT(*) FROM iot_work_order WHERE status<>'completed'"));
        metrics.put("controls", number("SELECT COUNT(*) FROM iot_control_log"));
        metrics.put("dataPoints", number("SELECT COUNT(*) FROM iot_telemetry"));
        return Map.of(
                "summary", metrics,
                "tenantRank", tenants(),
                "protocols", protocols(),
                "gateways", gateways(),
                "alerts", alerts().stream().limit(10).toList()
        );
    }

    private Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }

    private long number(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    private int intValue(Object value, int fallback) {
        try { return value == null ? fallback : Integer.parseInt(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private long longValue(Object value) {
        try { return value == null ? 0 : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return 0; }
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) throw new IllegalArgumentException(message);
        return value;
    }

    private String nowLabel() { return LocalDateTime.now().format(TIME); }

    /**
     * 运营留痕：操作人取当前令牌账号，来源 IP 取网关传下来的 X-Real-IP / X-Forwarded-For。
     *
     * <p>以前每条留痕的操作人都是代码里写死的"张运营""李运维"，审计日志等于没有审计对象。</p>
     */
    private void addLog(String action, String target, String detail) {
        jdbc.update("""
                INSERT INTO iot_ops_log (operator_name,action_name,target_name,detail_text,ip_address,created_at)
                VALUES (?,?,?,?,?,?)
                """, identity.requireOperatorName(), action, target, detail, identity.clientIp(), nowLabel());
    }
}
