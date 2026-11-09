package com.agri.iot.repository;

import com.agri.iot.integration.IotIdentityService;
import com.agri.iot.integration.ProductionPlotClient;
import com.agri.iot.integration.ProductionFarmClient;
import com.agri.iot.support.IotMetrics;
import com.agri.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Repository
public class IotAppRepository {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private final JdbcTemplate jdbc;
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.GatewayCommandService gatewayCommands;
    private final ProductionPlotClient productionPlots;
    private final ProductionFarmClient productionFarms;
    private final IotIdentityService identity;
    private final IotAlertRuleRepository alertRuleRepository;
    private final ObjectMapper objectMapper;

    public IotAppRepository(
            JdbcTemplate jdbc,
            ProductionPlotClient productionPlots,
            ProductionFarmClient productionFarms,
            IotIdentityService identity,
            IotAlertRuleRepository alertRuleRepository,
            ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.productionPlots = productionPlots;
        this.productionFarms = productionFarms;
        this.identity = identity;
        this.alertRuleRepository = alertRuleRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 当前租户的农场范围条件：{@code farm_id IN (?,?)} + 参数数组。
     *
     * <p>没有农场就等于没有任何可见数据，调用方必须返回空集合 —— 不能因为"范围是空的"
     * 就退化成不过滤。</p>
     */
    private String farmScopeSql(String column, List<Object> args) {
        List<Long> farmIds = identity.currentFarmIds();
        if (farmIds.isEmpty()) {
            return " AND 1=0";
        }
        args.addAll(farmIds);
        return " AND " + column + " IN (" + identity.farmPlaceholders(farmIds) + ")";
    }

    /**
     * 挂在设备上的表（遥测、控制日志）的租户范围条件。
     *
     * <p>它们自己没有 tenant_id，归属看设备：设备农场由令牌解析，
     * 不接受前端自报 farmId/deviceId。</p>
     */
    private String deviceScopeSql(String column, List<Object> args) {
        List<Long> farmIds = identity.currentFarmIds();
        if (farmIds.isEmpty()) {
            return " AND 1=0";
        }
        args.addAll(farmIds);
        return " AND " + column + " IN (SELECT id FROM iot_device WHERE farm_id IN ("
                + identity.farmPlaceholders(farmIds) + "))";
    }

    private long countWhere(String sql, List<Object> args) {
        Long value = jdbc.queryForObject(sql, Long.class, args.toArray());
        return value == null ? 0 : value;
    }

    /** 今日前缀：所有时间列统一存 yyyy-MM-dd HH:mm，取日期段做「今天」判定。 */
    private String todayPrefix() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) + "%";
    }

    /**
     * 读接口的租户口径：还没有可见农场时用 {@code -1}（查不到任何行），而不是抛 403。
     *
     * <p>设备列表在同样情况下返回空集合，如果告警/消息/场景因为这些表要按
     * {@code tenant_id} 过滤就报错，用户看到的是"设备页空白、告警页报错"两种口径。
     * 写接口不受影响，仍走 {@link IotIdentityService#currentTenantId()} 的严格判定。</p>
     */
    private long scopeTenantId() {
        Long tenantId = identity.tenantIdOrNull();
        return tenantId == null ? -1L : tenantId;
    }

    public Map<String, Object> overview() {
        List<Map<String, Object>> plotRows = plots();
        List<Map<String, Object>> currentFarms = farms();
        List<Object> deviceArgs = new ArrayList<>();
        long devices = countWhere("SELECT COUNT(*) FROM iot_device WHERE 1=1"
                + farmScopeSql("farm_id", deviceArgs), deviceArgs);
        List<Object> onlineArgs = new ArrayList<>();
        long online = countWhere("SELECT COUNT(*) FROM iot_device WHERE online_status='online'"
                + farmScopeSql("farm_id", onlineArgs), onlineArgs);
        List<Object> offlineArgs = new ArrayList<>();
        long offline = countWhere("SELECT COUNT(*) FROM iot_device WHERE online_status='offline'"
                + farmScopeSql("farm_id", offlineArgs), offlineArgs);
        long tenantId = scopeTenantId();
        long alerts = countWhere("SELECT COUNT(*) FROM iot_alert WHERE tenant_id=? AND status<>'resolved'",
                new ArrayList<>(List.of(tenantId)));
        List<Object> gatewayArgs = new ArrayList<>();
        long gateways = countWhere("SELECT COUNT(*) FROM iot_gateway WHERE 1=1"
                + farmScopeSql("farm_id", gatewayArgs), gatewayArgs);
        List<Object> controlArgs = new ArrayList<>();
        String controlScope = "SELECT COUNT(*) FROM iot_control_log WHERE 1=1"
                + deviceScopeSql("device_id", controlArgs);
        controlArgs.add(todayPrefix());
        long todayControl = countWhere(controlScope + " AND created_at LIKE ?", controlArgs);
        List<Object> dataArgs = new ArrayList<>();
        String dataScope = "SELECT COUNT(*) FROM iot_telemetry WHERE 1=1"
                + deviceScopeSql("device_id", dataArgs);
        dataArgs.add(todayPrefix());
        long dataToday = countWhere(dataScope + " AND recorded_at LIKE ?", dataArgs);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farm", farmBanner(currentFarms, devices, online, alerts));
        result.put("stats", Map.of(
                "devices", devices,
                "online", online,
                "offline", offline,
                "alerts", alerts,
                "plots", plotRows.size(),
                "gateways", gateways,
                "todayControl", todayControl,
                "dataToday", dataToday
        ));
        result.put("alerts", alerts(null).stream().limit(4).toList());
        result.put("plots", plotRows);
        result.put("groups", groups());
        List<Object> typeArgs = new ArrayList<>();
        // 范围条件放在 ON 里而不是 WHERE：LEFT JOIN 配 WHERE 会把"本租户一台都没有"的类型
        // 整行挤掉，饼图就变成只统计有设备的类型；用 HAVING 过滤空类型更直白
        String typeScope = farmScopeSql("d.farm_id", typeArgs);
        result.put("deviceTypes", jdbc.query("""
                SELECT t.type_name name,t.icon_text icon,COUNT(d.id) value
                FROM iot_device_type t LEFT JOIN iot_device d ON d.type_id=t.id""" + typeScope + """
                 GROUP BY t.id,t.type_name,t.icon_text HAVING COUNT(d.id)>0 ORDER BY value DESC
                """, (rs, rowNum) -> Map.of(
                "name", rs.getString("name"), "icon", rs.getString("icon"), "value", rs.getLong("value")),
                typeArgs.toArray()));
        result.put("environment", environment());
        result.put("series", environmentSeries());
        // 没有启用场景时返回 null（前端用可选链渲染"未启用场景"），不能让整块大盘 404
        List<Map<String, Object>> activeScenes = jdbc.query(
                "SELECT * FROM iot_scene WHERE tenant_id=? AND is_active=TRUE ORDER BY id LIMIT 1",
                sceneMapper(), tenantId);
        result.put("activeScene", activeScenes.isEmpty() ? null : activeScenes.get(0));
        List<Object> recentArgs = new ArrayList<>();
        result.put("recentControls", jdbc.query(
                "SELECT * FROM iot_control_log WHERE 1=1" + deviceScopeSql("device_id", recentArgs)
                        + " ORDER BY id DESC LIMIT 4", controlLogMapper(), recentArgs.toArray()));
        return result;
    }

    /**
     * 工作台横幅：租户名下农场的汇总档案。
     *
     * <p>原先这里写死 {@code SELECT * FROM iot_farm WHERE id=1}，第二个经营主体打开工作台
     * 看到的仍是 1 号农场（甚至不是它自己的农场）。现在用生产域按令牌返回的农场列表，
     * 计数用当前租户的实时值，多农场时在名字里写明还有几个。</p>
     */
    private Map<String, Object> farmBanner(List<Map<String, Object>> currentFarms, long devices, long online, long alerts) {
        Map<String, Object> banner = new LinkedHashMap<>();
        if (currentFarms.isEmpty()) {
            banner.put("id", 0L);
            banner.put("farmName", "尚未绑定生产农场");
            banner.put("manager", "—");
            banner.put("address", "请联系平台运营把账号绑定到经营主体下的农场");
            banner.put("area", BigDecimal.ZERO);
            banner.put("deviceCount", devices);
            banner.put("onlineCount", online);
            banner.put("alertCount", alerts);
            banner.put("status", "normal");
            return banner;
        }
        Map<String, Object> primary = currentFarms.get(0);
        double totalArea = currentFarms.stream()
                .mapToDouble(farm -> decimalValue(farm.get("totalArea")))
                .sum();
        String farmName = String.valueOf(primary.get("farmName"));
        if (currentFarms.size() > 1) {
            farmName = farmName + " 等 " + currentFarms.size() + " 个农场";
        }
        banner.put("id", primary.get("id"));
        banner.put("farmName", farmName);
        banner.put("manager", text(primary, "managerName", "待指派"));
        banner.put("phone", text(primary, "managerPhone", "未登记"));
        banner.put("address", text(primary, "address", "地址待补充"));
        banner.put("area", Math.round(totalArea * 10) / 10.0);
        banner.put("deviceCount", devices);
        banner.put("onlineCount", online);
        banner.put("alertCount", alerts);
        banner.put("status", alerts > 0 ? "alert" : "normal");
        return banner;
    }

    /**
     * 实时环境读数：当前租户设备里每个指标最近一次的采集值。
     *
     * <p>原先这里是五个写死的常量（27.6℃/68%/24.1%…），换租户、换时间都不变，
     * 页面右上角写着"实时"。现在按 {@code iot_telemetry} 实查，涨跌取同一指标上一条读数，
     * 等级按<b>当前主体生效阈值</b>判定（主体自定义会覆盖平台预置）。</p>
     */
    private List<Map<String, Object>> environment() {
        List<Map<String, Object>> rules = alertRuleRepository.effectiveRules();
        List<Object> args = new ArrayList<>();
        String scope = deviceScopeSql("t.device_id", args);
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT metric_key,metric_value,unit_name,recorded_at,rn FROM (
                    SELECT t.metric_key,t.metric_value,t.unit_name,t.recorded_at,
                           ROW_NUMBER() OVER (PARTITION BY t.metric_key ORDER BY t.recorded_at DESC,t.id DESC) rn
                    FROM iot_telemetry t WHERE 1=1""" + scope + """
                ) x WHERE x.rn<=2
                """, (rs, rowNum) -> map(
                "key", rs.getString("metric_key"),
                "value", rs.getBigDecimal("metric_value"),
                "unit", rs.getString("unit_name"),
                "rank", rs.getInt("rn")), args.toArray());
        Map<String, BigDecimal[]> latestAndPrevious = new LinkedHashMap<>();
        Map<String, String> units = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String key = String.valueOf(row.get("key"));
            if (IotMetrics.ACTUATOR_KEYS.contains(key)) {
                // 开关/转速这类是执行器的动作状态，不是环境读数，放进"实时环境"卡片会误导
                continue;
            }
            int rank = (int) longValue(row.get("rank"), 0);
            BigDecimal[] pair = latestAndPrevious.computeIfAbsent(key, ignored -> new BigDecimal[2]);
            if (rank == 1) {
                pair[0] = (BigDecimal) row.get("value");
                units.put(key, String.valueOf(row.get("unit") == null ? "" : row.get("unit")));
            } else if (rank == 2) {
                pair[1] = (BigDecimal) row.get("value");
            }
        }
        List<String> order = List.of("temperature", "humidity", "soil_moisture", "light",
                "light_intensity", "co2", "rain", "ec", "ph", "soil_temp");
        List<String> keys = latestAndPrevious.keySet().stream()
                .filter(key -> !IotMetrics.ACTUATOR_KEYS.contains(key))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        keys.sort(java.util.Comparator.comparingInt(key -> {
            int index = order.indexOf(key);
            return index < 0 ? order.size() : index;
        }));
        List<Map<String, Object>> metrics = new ArrayList<>();
        for (String key : keys) {
            BigDecimal[] pair = latestAndPrevious.get(key);
            BigDecimal value = pair[0];
            int change = value == null || pair[1] == null ? 0
                    : value.subtract(pair[1]).setScale(0, java.math.RoundingMode.HALF_UP).intValue();
            String level = alertRuleRepository.judgeLevel(key, value, rules);
            metrics.add(map(
                    "name", IotMetrics.metricName(key),
                    "value", value == null ? BigDecimal.ZERO : value.setScale(1, java.math.RoundingMode.HALF_UP),
                    "unit", units.getOrDefault(key, ""),
                    "key", "light_intensity".equals(key) ? "light" : key,
                    "change", change,
                    // status 给样式用（页面只有 normal/warning/critical 三种配色），level 给语义用
                    "status", switch (level) {
                        case "critical" -> "critical";
                        case "major" -> "warning";
                        default -> "normal";
                    },
                    "level", level));
        }
        // 卡片按 5 列排布，只展示优先级最高的几路环境读数；一台设备的全部指标在设备详情里看
        return metrics.size() > 5 ? metrics.subList(0, 5) : metrics;
    }

    /**
     * 环境趋势：最近一个有读数的日期按小时聚合。
     *
     * <p>写死的 7 个时间点（08:00~14:00）换成按 {@code iot_telemetry.recorded_at} 实查；
     * 没有任何读数时返回空列表，页面显示空图而不是假曲线。</p>
     */
    private List<Map<String, Object>> environmentSeries() {
        if (identity.currentFarmIds().isEmpty()) {
            return List.of();
        }
        List<Object> dayArgs = new ArrayList<>();
        String dayScope = deviceScopeSql("device_id", dayArgs);
        String day = jdbc.queryForObject("SELECT MAX(SUBSTRING(recorded_at,1,10)) FROM iot_telemetry WHERE 1=1"
                + dayScope, String.class, dayArgs.toArray());
        if (day == null || !day.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return List.of();
        }
        List<Object> args = new ArrayList<>();
        String scope = deviceScopeSql("device_id", args);
        args.add(day);
        return jdbc.query("""
                SELECT SUBSTRING(recorded_at,12,2) hour,
                       COALESCE(ROUND(AVG(CASE WHEN metric_key='temperature' THEN metric_value END),1),0) temperature,
                       COALESCE(ROUND(AVG(CASE WHEN metric_key='humidity' THEN metric_value END),1),0) humidity,
                       COALESCE(ROUND(AVG(CASE WHEN metric_key='soil_moisture' THEN metric_value END),1),0) soilMoisture
                FROM iot_telemetry WHERE 1=1""" + scope + """
                 AND SUBSTRING(recorded_at,1,10)=?
                GROUP BY SUBSTRING(recorded_at,12,2)
                HAVING COUNT(CASE WHEN metric_key IN ('temperature','humidity','soil_moisture') THEN 1 END)>0
                ORDER BY hour
                """, (rs, rowNum) -> map(
                "time", rs.getString("hour") + ":00",
                "temperature", rs.getBigDecimal("temperature"),
                "humidity", rs.getBigDecimal("humidity"),
                "soilMoisture", rs.getBigDecimal("soilMoisture")), args.toArray());
    }

    public List<Map<String, Object>> devices(String keyword, String status, Long groupId, Long plotId) {
        synchronizeDeviceOwnership(identity.currentFarms());
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT * FROM iot_device WHERE 1=1"
                + farmScopeSql("farm_id", args));
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(device_name) LIKE ? OR LOWER(device_code) LIKE ?)");
            String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
            args.add(like);
            args.add(like);
        }
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND online_status=?");
            args.add(status);
        }
        if (groupId != null) {
            sql.append(" AND group_id=?");
            args.add(groupId);
        }
        if (plotId != null) {
            sql.append(" AND plot_id=?");
            args.add(plotId);
        }
        sql.append(" ORDER BY CASE online_status WHEN 'alert' THEN 0 WHEN 'offline' THEN 1 ELSE 2 END,id");
        return jdbc.query(sql.toString(), deviceMapper(), args.toArray());
    }

    public List<Map<String, Object>> farms() {
        return productionFarms.listCurrentTenantFarms();
    }

    /**
     * 设备数量统计。
     *
     * <p>统计口径与 {@link #devices} 完全一致（同一张表、同一个租户农场范围），
     * 否则"列表 29 台、统计 31 台"这种对不上的问题迟早会冒出来。</p>
     *
     * @param farmId 农场 ID，为空表示当前租户全部农场
     * @return total / online / offline / alert 四项计数
     */
    public Map<String, Object> deviceStats(Long farmId) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*) total,
                       SUM(CASE WHEN online_status='online' THEN 1 ELSE 0 END) online,
                       SUM(CASE WHEN online_status='offline' THEN 1 ELSE 0 END) offline,
                       SUM(CASE WHEN online_status='alert' THEN 1 ELSE 0 END) alert
                FROM iot_device WHERE 1=1""" + farmScopeSql("farm_id", args));
        if (farmId != null && farmId > 0) {
            // 指定农场时仍然带着租户范围：换个 farmId 就看到别家的设备数是读不出来的
            sql.append(" AND farm_id=?");
            args.add(farmId);
        }
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", 0L);
        stats.put("online", 0L);
        stats.put("offline", 0L);
        stats.put("alert", 0L);
        jdbc.query(sql.toString(), rs -> {
            stats.put("total", rs.getLong("total"));
            stats.put("online", rs.getLong("online"));
            stats.put("offline", rs.getLong("offline"));
            stats.put("alert", rs.getLong("alert"));
        }, args.toArray());
        return stats;
    }

    /**
     * 设备详情。
     *
     * <p>先按令牌解析出的租户校验设备归属，再取遥测/历史/控制记录：
     * 原先这里 {@code WHERE id=?} 直接按前端给的 id 读，换个数就能看别家的
     * 设备档案、读数与操作记录（连控制日志里的操作人都能读到）。
     * 越权一律 404，不告诉调用方"这个 id 存在但不给你"。</p>
     */
    public Map<String, Object> device(long id) {
        identity.requireDeviceAccess(id);
        Map<String, Object> device = queryOne("SELECT * FROM iot_device WHERE id=?", deviceMapper(), id);
        device.put("telemetry", jdbc.query(
                "SELECT * FROM iot_telemetry WHERE device_id=? ORDER BY id", telemetryMapper(), id));
        device.put("history", jdbc.query("""
                SELECT recorded_at time,MAX(CASE WHEN metric_key='temperature' THEN metric_value END) temperature,
                       MAX(CASE WHEN metric_key='humidity' THEN metric_value END) humidity,
                       MAX(CASE WHEN metric_key='soil_moisture' THEN metric_value END) soilMoisture
                FROM iot_telemetry WHERE device_id=? GROUP BY recorded_at ORDER BY MIN(id)
                """, (rs, rowNum) -> map(
                "time", rs.getString("time"),
                "temperature", rs.getBigDecimal("temperature"),
                "humidity", rs.getBigDecimal("humidity"),
                "soilMoisture", rs.getBigDecimal("soilMoisture")), id));
        device.put("controls", jdbc.query(
                "SELECT * FROM iot_control_log WHERE device_id=? ORDER BY id DESC LIMIT 8", controlLogMapper(), id));
        return device;
    }

    public List<Map<String, Object>> deviceTypes() {
        return jdbc.query("""
                SELECT * FROM iot_device_type
                WHERE status IS NULL OR status='active'
                ORDER BY id
                """, deviceTypeMapper());
    }

    @Transactional
    public Map<String, Object> createDevice(Map<String, Object> body) {
        String code = required(body, "deviceCode", "请输入设备编码").toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]{2,59}")) {
            throw new IllegalArgumentException("设备编码只能包含大写字母、数字、横线和下划线");
        }
        String name = required(body, "deviceName", "请输入设备名称");
        Integer duplicateCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM iot_device WHERE device_code=?", Integer.class, code);
        if (duplicateCount != null && duplicateCount > 0) {
            throw new IllegalArgumentException("设备编码已存在，请更换后重试");
        }
        long typeId = requiredLong(body, "typeId", "请选择设备类型");
        Map<String, Object> type = queryOne("SELECT * FROM iot_device_type WHERE id=?", deviceTypeMapper(), typeId);
        if (!"active".equals(type.get("status"))) {
            throw new IllegalArgumentException("所选设备类型已停用");
        }
        long farmId = requiredLong(body, "farmId", "请选择生产农场");
        Map<String, Object> farm = productionFarms.requireCurrentTenantFarm(farmId);
        Long tenantId = longObject(farm.get("tenantId"));
        if (tenantId == null) {
            throw new IllegalArgumentException("生产农场未关联有效租户");
        }
        long gatewayId = requiredLong(body, "gatewayId", "请选择接入网关");
        Map<String, Object> gateway = identity.requireGateway(gatewayId);
        if (longValue(gateway.get("farmId"), -1) != farmId) {
            throw new IllegalArgumentException("接入网关不属于所选生产农场");
        }
        long groupId = requiredLong(body, "groupId", "请选择设备分组");
        identity.requireTenantRow("iot_device_group", groupId, "设备分组");
        Long plotId = longObject(body.get("plotId"));
        if (plotId != null && plotId <= 0) {
            throw new IllegalArgumentException("地块标识无效");
        }
        if (plotId != null) {
            Map<String, Object> plot = productionPlots.listCurrentTenantPlots().stream()
                    .filter(item -> longValue(item.get("id"), -1) == plotId)
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("所选地块不属于当前生产管理租户"));
            if (longValue(plot.get("farmId"), -1) != farmId) {
                throw new IllegalArgumentException("所选地块与农场不一致");
            }
        }
        String config = text(body, "config", "{\"reportInterval\":30}");
        validateJson(config, "设备扩展配置必须是有效的 JSON");
        String now = LocalDateTime.now().format(TIME);
        try {
            jdbc.update("""
                    INSERT INTO iot_device
                    (tenant_id,farm_id,plot_id,gateway_id,group_id,device_code,device_name,type_id,type_name,
                     protocol_name,online_status,status_text,last_report,signal_strength,battery_rate,firmware_version,
                     latitude,longitude,control_capable,config_text,created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?, 'offline','normal','等待首次上报',-90,100,?,?,?,?,?,?)
                    """, tenantId, farmId, plotId, gatewayId, groupId, code, name, typeId, type.get("name"),
                    type.get("protocol"), text(body, "firmwareVersion", "v1.0.0"),
                    decimalObject(body.get("latitude")), decimalObject(body.get("longitude")),
                    Boolean.TRUE.equals(body.get("controlCapable")), config, now);
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("设备编码已存在，请更换后重试");
        }
        jdbc.update("UPDATE iot_device_group SET device_count=device_count+1 WHERE id=?", groupId);
        jdbc.update("UPDATE iot_gateway SET total_count=total_count+1 WHERE id=?", gatewayId);
        // 地块侧不维护设备数：地块列表的设备数/在线数是 plots() 里按 plot_id 实时聚合的
        addLog("注册设备", code, name + " · " + farm.get("farmName") + " · 租户 " + tenantId);
        return queryOne("SELECT * FROM iot_device WHERE device_code=?", deviceMapper(), code);
    }

    /**
     * 更新设备。
     *
     * <p>注册之后原来没有任何修改入口 —— 设备装错了棚、换了网关、要挪地块，只能删了重注册，
     * 但设备编码唯一、历史遥测又挂在原 id 上，实际根本没法重来。这里补上更新能力。</p>
     *
     * <p>{@code plotId} 允许显式传 {@code null} 表示「解除地块归属」，因此用
     * {@code containsKey} 而不是取值判空来区分「不改」与「改为空」。</p>
     */
    @Transactional
    public Map<String, Object> updateDevice(long id, Map<String, Object> body) {
        identity.requireDeviceAccess(id);
        Map<String, Object> device = queryOne("SELECT * FROM iot_device WHERE id=?", deviceMapper(), id);
        long farmId = longValue(device.get("farmId"), -1);
        Long oldGroupId = longObject(device.get("groupId"));
        Long oldGatewayId = longObject(device.get("gatewayId"));

        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();

        if (body.containsKey("deviceName")) {
            String name = text(body, "deviceName", "");
            if (name.isBlank()) {
                throw new IllegalArgumentException("设备名称不能为空");
            }
            sets.add("device_name=?");
            args.add(name);
        }
        if (body.containsKey("firmwareVersion")) {
            sets.add("firmware_version=?");
            args.add(text(body, "firmwareVersion", "v1.0.0"));
        }
        if (body.containsKey("config")) {
            String config = text(body, "config", "");
            validateJson(config, "设备扩展配置必须是有效的 JSON");
            sets.add("config_text=?");
            args.add(config);
        }
        if (body.containsKey("latitude")) {
            sets.add("latitude=?");
            args.add(decimalObject(body.get("latitude")));
        }
        if (body.containsKey("longitude")) {
            sets.add("longitude=?");
            args.add(decimalObject(body.get("longitude")));
        }
        if (body.containsKey("controlCapable")) {
            sets.add("control_capable=?");
            args.add(Boolean.TRUE.equals(body.get("controlCapable")));
        }

        // 地块：null 表示解除归属；非空则必须属于该设备所在农场
        if (body.containsKey("plotId")) {
            Long candidate = longObject(body.get("plotId"));
            if (candidate != null && candidate <= 0) {
                throw new IllegalArgumentException("地块标识无效");
            }
            if (candidate != null) {
                final Long targetPlotId = candidate;
                Map<String, Object> plot = productionPlots.listCurrentTenantPlots().stream()
                        .filter(item -> longValue(item.get("id"), -1) == targetPlotId)
                        .findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("所选地块不属于当前生产管理租户"));
                if (longValue(plot.get("farmId"), -1) != farmId) {
                    throw new IllegalArgumentException("所选地块与设备所属农场不一致");
                }
            }
            sets.add("plot_id=?");
            args.add(candidate);
        }

        // 分组：变更时同步两边的设备计数
        Long newGroupId = oldGroupId;
        if (body.containsKey("groupId")) {
            newGroupId = longObject(body.get("groupId"));
            if (newGroupId != null) {
                identity.requireTenantRow("iot_device_group", newGroupId, "设备分组");
            }
            sets.add("group_id=?");
            args.add(newGroupId);
        }

        // 网关：必须属于同一农场
        Long newGatewayId = oldGatewayId;
        if (body.containsKey("gatewayId")) {
            newGatewayId = longObject(body.get("gatewayId"));
            if (newGatewayId != null) {
                Map<String, Object> gateway = identity.requireGateway(newGatewayId);
                if (longValue(gateway.get("farmId"), -1) != farmId) {
                    throw new IllegalArgumentException("接入网关不属于该设备所在农场");
                }
            }
            sets.add("gateway_id=?");
            args.add(newGatewayId);
        }

        if (sets.isEmpty()) {
            return device;
        }
        args.add(id);
        jdbc.update("UPDATE iot_device SET " + String.join(",", sets) + " WHERE id=?", args.toArray());

        if (!java.util.Objects.equals(oldGroupId, newGroupId)) {
            if (oldGroupId != null) {
                jdbc.update("UPDATE iot_device_group SET device_count=GREATEST(device_count-1,0) WHERE id=?", oldGroupId);
            }
            if (newGroupId != null) {
                jdbc.update("UPDATE iot_device_group SET device_count=device_count+1 WHERE id=?", newGroupId);
            }
        }
        if (!java.util.Objects.equals(oldGatewayId, newGatewayId)) {
            if (oldGatewayId != null) {
                jdbc.update("UPDATE iot_gateway SET total_count=GREATEST(total_count-1,0) WHERE id=?", oldGatewayId);
            }
            if (newGatewayId != null) {
                jdbc.update("UPDATE iot_gateway SET total_count=total_count+1 WHERE id=?", newGatewayId);
            }
        }
        // 地块侧不维护设备数（同上，plots() 实时聚合）

        addLog("更新设备", String.valueOf(device.get("deviceCode")),
                String.valueOf(device.get("deviceName")) + " · 字段 " + String.join("/", sets));
        return queryOne("SELECT * FROM iot_device WHERE id=?", deviceMapper(), id);
    }

    /**
     * 远程控制。
     *
     * <p>这里是本模块风险最高的一条：改之前任何人换个 deviceId 就能开别家的阀门和风机，
     * 操作人还固定写"陈建国"，控制回执是代码里写死的"指令已下发，设备已确认"。</p>
     *
     * <p>现在：设备归属按令牌校验；操作人取登录账号；回执只声明"已下发到边缘网关"——
     * 平台没有真机链路，设备是否执行成功要等接入侧回传，不能替设备确认。</p>
     */
    public Map<String, Object> controlDevice(long id, Map<String, Object> body) {
        return controlDevice(id, body, identity.requireOperatorName());
    }

    private Map<String, Object> controlDevice(long id, Map<String, Object> body, String operator) {
        identity.requireDeviceAccess(id);
        Map<String, Object> device = queryOne("SELECT * FROM iot_device WHERE id=?", deviceMapper(), id);
        if (!Boolean.TRUE.equals(device.get("controlCapable"))) {
            throw new IllegalArgumentException("该设备不支持远程控制");
        }
        String action = required(body, "action", "请选择控制动作");
        return new com.agri.iot.service.DeviceCommandService(jdbc).register(id,
                String.valueOf(device.get("deviceName")), action, operator);
    }

    public List<Map<String, Object>> plots() {
        List<Map<String, Object>> currentFarms = identity.currentFarms();
        Map<Long, Map<String, Object>> farmById = currentFarms.stream()
                .filter(item -> longObject(item.get("id")) != null)
                .collect(java.util.stream.Collectors.toMap(
                        item -> longObject(item.get("id")),
                        item -> item,
                        (left, right) -> left));
        List<Long> farmIds = currentFarms.stream()
                .map(item -> longObject(item.get("id")))
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
        List<Map<String, Object>> plots = new ArrayList<>(productionPlots.listCurrentTenantPlots());
        Map<Long, long[]> deviceStats = new LinkedHashMap<>();
        if (!farmIds.isEmpty()) {
            StringBuilder sql = new StringBuilder("""
                    SELECT plot_id,COUNT(*) device_count,
                           SUM(CASE WHEN online_status='online' THEN 1 ELSE 0 END) online_count
                    FROM iot_device WHERE plot_id IS NOT NULL AND farm_id IN (
                    """);
            sql.append(String.join(",", java.util.Collections.nCopies(farmIds.size(), "?")));
            sql.append(") GROUP BY plot_id");
            jdbc.query(sql.toString(), rs -> {
                deviceStats.put(rs.getLong("plot_id"), new long[]{
                        rs.getLong("device_count"), rs.getLong("online_count")
                });
            }, farmIds.toArray());
        }
        for (Map<String, Object> plot : plots) {
            Long plotId = longObject(plot.get("id"));
            Long farmId = longObject(plot.get("farmId"));
            Map<String, Object> farm = farmId == null ? null : farmById.get(farmId);
            if (farm != null) {
                plot.put("farmName", farm.get("farmName"));
                plot.put("farmCode", farm.get("farmCode"));
                plot.put("tenantId", farm.get("tenantId"));
            }
            long[] stats = plotId == null ? null : deviceStats.get(plotId);
            long deviceCount = stats == null ? 0 : stats[0];
            long onlineCount = stats == null ? 0 : stats[1];
            plot.put("deviceCount", deviceCount);
            plot.put("onlineCount", onlineCount);
            plot.put("deviceOnlineRate", deviceCount == 0
                    ? 0
                    : Math.round(onlineCount * 1000.0 / deviceCount) / 10.0);
        }
        return plots;
    }

    /** 设备分组：每个经营主体一套，原先全平台共用一份，第二个租户能在下拉里看到别家的分组。 */
    public List<Map<String, Object>> groups() {
        return jdbc.query("SELECT * FROM iot_device_group WHERE tenant_id=? ORDER BY id",
                groupMapper(), scopeTenantId());
    }

    public List<Map<String, Object>> gateways() {
        List<Object> args = new ArrayList<>();
        String sql = "SELECT * FROM iot_gateway WHERE 1=1" + farmScopeSql("farm_id", args)
                + " ORDER BY CASE online_status WHEN 'offline' THEN 0 WHEN 'alert' THEN 1 ELSE 2 END,id";
        List<Map<String, Object>> rows = jdbc.query(sql, gatewayMapper(), args.toArray());
        Map<Long, Map<String, Object>> farmById = identity.currentFarms().stream()
                .filter(item -> longObject(item.get("id")) != null)
                .collect(java.util.stream.Collectors.toMap(
                        item -> longObject(item.get("id")),
                        item -> item,
                        (left, right) -> left));
        for (Map<String, Object> gateway : rows) {
            refreshGatewayCounts(gateway);
            Map<String, Object> farm = farmById.get(longObject(gateway.get("farmId")));
            gateway.put("farmName", farm == null ? null : farm.get("farmName"));
            gateway.put("farmCode", farm == null ? null : farm.get("farmCode"));
            gateway.put("tenantId", farm == null ? null : farm.get("tenantId"));
            gateway.put("source", "production");
        }
        return rows;
    }

    public Map<String, Object> gateway(long id) {
        Map<String, Object> gateway = gateways().stream()
                .filter(item -> longObject(item.get("id")) == id)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("边缘网关不存在：" + id));
        gateway.put("devices", jdbc.query("SELECT * FROM iot_device WHERE gateway_id=? ORDER BY id", deviceMapper(), id));
        return gateway;
    }

    @Transactional
    public Map<String, Object> createGateway(Map<String, Object> body) {
        String code = required(body, "gatewayCode", "请输入网关编码").toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]{2,49}")) {
            throw new IllegalArgumentException("网关编码只能包含大写字母、数字、横线和下划线");
        }
        Integer duplicateCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM iot_gateway WHERE gateway_code=?", Integer.class, code);
        if (duplicateCount != null && duplicateCount > 0) {
            throw new IllegalArgumentException("网关编码已存在，请更换后重试");
        }
        long farmId = requiredLong(body, "farmId", "请选择生产农场");
        productionFarms.requireCurrentTenantFarm(farmId);
        String ipAddress = text(body, "ipAddress", "");
        validateIpAddress(ipAddress);
        try {
            jdbc.update("""
                    INSERT INTO iot_gateway
                    (farm_id,gateway_code,gateway_name,gateway_model,protocol_name,firmware_version,
                     ip_address,online_count,total_count,online_status,cpu_rate,memory_rate,last_online)
                    VALUES (?,?,?,?,?,?,?,0,0,'offline',0,0,'等待首次上报')
                    """, farmId, code,
                    required(body, "gatewayName", "请输入网关名称"),
                    text(body, "model", "通用边缘网关"),
                    required(body, "protocol", "请选择接入协议"),
                    text(body, "firmwareVersion", "v1.0.0"),
                    ipAddress);
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("网关编码已存在，请更换后重试");
        }
        addLog("新增边缘网关", code, "生产农场 " + farmId);
        return gatewayByCode(code);
    }

    @Transactional
    public Map<String, Object> updateGateway(long id, Map<String, Object> body) {
        Map<String, Object> existing = gateway(id);
        String code = required(body, "gatewayCode", "请输入网关编码").toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]{2,49}")) {
            throw new IllegalArgumentException("网关编码只能包含大写字母、数字、横线和下划线");
        }
        Integer duplicateCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM iot_gateway WHERE gateway_code=? AND id<>?",
                Integer.class, code, id);
        if (duplicateCount != null && duplicateCount > 0) {
            throw new IllegalArgumentException("网关编码已存在，请更换后重试");
        }
        long farmId = requiredLong(body, "farmId", "请选择生产农场");
        productionFarms.requireCurrentTenantFarm(farmId);
        long totalCount = longValue(existing.get("totalCount"), 0);
        if (totalCount > 0 && longValue(existing.get("farmId"), -1) != farmId) {
            throw new IllegalArgumentException("网关已挂载设备，不能直接迁移到其他农场");
        }
        String ipAddress = text(body, "ipAddress", "");
        validateIpAddress(ipAddress);
        jdbc.update("""
                UPDATE iot_gateway SET farm_id=?,gateway_code=?,gateway_name=?,gateway_model=?,
                    protocol_name=?,firmware_version=?,ip_address=? WHERE id=?
                """, farmId, code,
                required(body, "gatewayName", "请输入网关名称"),
                text(body, "model", "通用边缘网关"),
                required(body, "protocol", "请选择接入协议"),
                text(body, "firmwareVersion", "v1.0.0"),
                ipAddress, id);
        addLog("编辑边缘网关", code,
                String.valueOf(existing.get("gatewayName")) + " → " + text(body, "gatewayName", ""));
        return gateway(id);
    }

    @Transactional
    public Map<String, Object> deleteGateway(long id) {
        Map<String, Object> gateway = gateway(id);
        long totalCount = longValue(gateway.get("totalCount"), 0);
        if (totalCount > 0) {
            throw new IllegalArgumentException("网关仍挂载设备，请先迁移或移除设备");
        }
        jdbc.update("DELETE FROM iot_gateway WHERE id=?", id);
        addLog("删除边缘网关", String.valueOf(gateway.get("gatewayCode")),
                String.valueOf(gateway.get("gatewayName")));
        return Map.of("id", id, "gatewayCode", gateway.get("gatewayCode"));
    }

    /** 登记网关重启指令，执行结果以接入端回执为准，不改变心跳。 */
    @Transactional
    public Map<String, Object> restartGateway(long id) {
        Map<String,Object> gateway = gateway(id);
        return gatewayCommands.register(id,"GW-"+id,"重启网关",identity.requireOperatorName());
    }

    /**
     * 告警列表。
     *
     * <p>原先写死 {@code WHERE tenant_id=1}：1 号租户看到全平台的告警，
     * 其它主体一条也看不到。现在按令牌解析出的经营主体过滤。</p>
     */
    public List<Map<String, Object>> alerts(String status) {
        long tenantId = scopeTenantId();
        String order = " ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'handling' THEN 1 ELSE 2 END,id DESC";
        if (status == null || status.isBlank() || "all".equals(status)) {
            return jdbc.query("SELECT * FROM iot_alert WHERE tenant_id=?" + order, alertMapper(), tenantId);
        }
        return jdbc.query("SELECT * FROM iot_alert WHERE tenant_id=? AND status=?" + order,
                alertMapper(), tenantId, status);
    }

    /**
     * 处置告警。
     *
     * <p>改之前：{@code UPDATE iot_alert SET ... WHERE id=?} 不带任何归属条件，
     * 处置人还从请求体里取（前端写谁就是谁）。现在先按租户校验归属，
     * 处置人取令牌账号，状态只接受三种流转值。</p>
     */
    @Transactional
    public Map<String, Object> handleAlert(long id, Map<String, Object> body) {
        identity.requireTenantRow("iot_alert", id, "告警");
        transitionAlert(jdbc, id, body, identity.requireOperatorName());
        addLog("处置告警", "IOT-ALERT-" + id, String.valueOf(body.get("note")));
        return queryOne("SELECT * FROM iot_alert WHERE id=?", alertMapper(), id);
    }

    /** 双端共用状态与审计规则；条件更新防止并发请求覆盖历史。 */
    static void transitionAlert(JdbcTemplate jdbc, long id, Map<String, Object> body, String operator) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT status,handle_note FROM iot_alert WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("告警不存在");
        String current = String.valueOf(rows.get(0).get("status"));
        String next = body.get("status") == null ? "resolved" : String.valueOf(body.get("status"));
        if (!("pending".equals(current) && "handling".equals(next))
                && !("handling".equals(current) && "resolved".equals(next))) {
            throw new IllegalArgumentException("状态已变化或不允许跳转；请按待处理→处理中→已处理顺序操作并刷新");
        }
        String note = body.get("note") == null ? "" : String.valueOf(body.get("note")).trim();
        if (note.length() < 4 || note.length() > 200) throw new IllegalArgumentException("请填写4至200字的实际处置说明");
        String old = rows.get(0).get("handle_note") == null ? "" : String.valueOf(rows.get(0).get("handle_note"));
        String history = old + (old.isBlank() ? "" : "\n") + "[" + LocalDateTime.now()
                + " · " + operator + " · " + next + "] " + note;
        if (history.length() > 800) throw new IllegalArgumentException("处置历史超过800字容量，禁止覆盖或截断原凭据");
        int changed = jdbc.update("UPDATE iot_alert SET status=?,handled_by=?,handle_note=?,handled_at=? WHERE id=? AND status=?",
                next, operator, history, LocalDateTime.now().format(TIME), id, current);
        if (changed != 1) throw new IllegalArgumentException("告警状态已被其他操作更新，请刷新");
    }

    /**
     * 告警阈值规则：平台预置，用户端只读。
     *
     * <p>{@code iot_alert_rule} 没有租户列，作用范围是 {@code tenant_scope} 里的一段自由文本，
     * {@code enabled} 是全局开关。以前用户端给这一列做了「停用/启用」按钮，
     * 任何一个合作社点一下就把全平台的「大棚高温告警」关掉了 —— 这不是租户自己的配置，
     * 所以这里只保留读取，写接口从用户端下线（要调整阈值走平台运营）。</p>
     */
    public List<Map<String, Object>> alertRules() {
        return jdbc.query("SELECT * FROM iot_alert_rule ORDER BY id", alertRuleMapper());
    }

    public List<Map<String, Object>> scenes() {
        return jdbc.query("SELECT * FROM iot_scene WHERE tenant_id=? ORDER BY is_active DESC,id",
                sceneMapper(), scopeTenantId());
    }

    @Transactional
    public Map<String, Object> createScene(Map<String, Object> body) {
        long tenantId = identity.currentTenantId();
        String name = required(body, "sceneName", "请输入场景名称");
        String code = text(body, "sceneCode", "SCENE-" + System.currentTimeMillis());
        if (code.length() > 40) {
            throw new IllegalArgumentException("场景标识不能超过 40 个字符");
        }
        Integer duplicateCode = jdbc.queryForObject(
                "SELECT COUNT(*) FROM iot_scene WHERE scene_code=?", Integer.class, code);
        if (duplicateCode != null && duplicateCode > 0) {
            throw new IllegalArgumentException("场景标识已存在，请更换后重试");
        }
        String config = text(body, "config", "{}");
        validateJson(config, "场景执行配置必须是有效的 JSON");
        try {
            jdbc.update("""
                    INSERT INTO iot_scene
                    (tenant_id,scene_code,scene_name,icon_text,category_name,description,config_text,is_active,plot_count)
                    VALUES (?,?,?,?,?,?,?,FALSE,?)
                    """, tenantId, code, name, text(body, "icon", "⚙️"),
                    text(body, "category", "自定义场景"), text(body, "description", ""),
                    config, (int) longValue(body.get("plotCount"), 0));
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("场景标识已存在，请更换后重试");
        }
        addLog("创建场景", name, text(body, "description", ""));
        return queryOne("SELECT * FROM iot_scene WHERE scene_code=?", sceneMapper(), code);
    }

    @Transactional
    public Map<String, Object> updateScene(long id, Map<String, Object> body) {
        identity.requireTenantRow("iot_scene", id, "场景");
        Map<String, Object> existing = queryOne("SELECT * FROM iot_scene WHERE id=?", sceneMapper(), id);
        String name = required(body, "sceneName", "请输入场景名称");
        String config = text(body, "config", "{}");
        validateJson(config, "场景执行配置必须是有效的 JSON");
        jdbc.update("""
                UPDATE iot_scene SET scene_name=?,icon_text=?,category_name=?,description=?,
                    config_text=?,plot_count=? WHERE id=?
                """, name, text(body, "icon", "⚙️"), text(body, "category", "自定义场景"),
                text(body, "description", ""), config,
                (int) longValue(body.get("plotCount"), 0), id);
        addLog("编辑场景", String.valueOf(existing.get("sceneName")), name);
        return queryOne("SELECT * FROM iot_scene WHERE id=?", sceneMapper(), id);
    }

    @Transactional
    public Map<String, Object> deleteScene(long id) {
        identity.requireTenantRow("iot_scene", id, "场景");
        Map<String, Object> scene = queryOne("SELECT * FROM iot_scene WHERE id=?", sceneMapper(), id);
        if (Boolean.TRUE.equals(scene.get("active"))) {
            throw new IllegalArgumentException("当前运行中的场景不能删除，请先启用其他场景");
        }
        jdbc.update("DELETE FROM iot_scene WHERE id=?", id);
        addLog("删除场景", String.valueOf(scene.get("sceneName")), "场景配置已删除");
        return Map.of("id", id, "sceneName", scene.get("sceneName"));
    }

    /**
     * 启用场景。
     *
     * <p>"同一时刻只有一个场景在跑"是<b>每个主体各自</b>的约束：以前这里
     * {@code UPDATE iot_scene SET is_active=FALSE} 全表清空，
     * 一个合作社启用场景会把别家正在运行的场景静默停掉。现在只清自己的。</p>
     */
    @Transactional
    public Map<String, Object> activateScene(long id) {
        long tenantId = identity.currentTenantId();
        identity.requireTenantRow("iot_scene", id, "场景");
        Map<String, Object> scene = queryOne("SELECT * FROM iot_scene WHERE id=?", sceneMapper(), id);
        jdbc.update("UPDATE iot_scene SET is_active=FALSE WHERE tenant_id=?", tenantId);
        jdbc.update("UPDATE iot_scene SET is_active=TRUE WHERE id=?", id);
        addLog("启用场景", String.valueOf(scene.get("sceneName")), "场景配置已下发");
        return queryOne("SELECT * FROM iot_scene WHERE id=?", sceneMapper(), id);
    }

    public List<Map<String, Object>> rules() {
        return jdbc.query("""
                SELECT r.*,c.rule_type,c.trigger_metric,c.operator_text,c.threshold_value,
                       c.duration_seconds,c.schedule_text,c.action_device_id,c.action_device_name,
                       c.action_command,c.action_value,c.cooldown_seconds,c.config_json,c.updated_at
                FROM iot_rule r LEFT JOIN iot_rule_config c ON c.rule_id=r.id
                WHERE r.tenant_id=?
                ORDER BY r.id
                """, ruleMapper(), scopeTenantId());
    }

    @Transactional
    public Map<String, Object> createRule(Map<String, Object> body) {
        long tenantId = identity.currentTenantId();
        String name = required(body, "ruleName", "请输入规则名称");
        String code = text(body, "ruleCode", "RULE-AUTO-" + System.currentTimeMillis());
        if (code.length() > 40) {
            throw new IllegalArgumentException("规则标识不能超过 40 个字符");
        }
        boolean enabled = body.get("enabled") == null || Boolean.TRUE.equals(body.get("enabled"));
        validateRuleConfig(body);
        Integer duplicateCode = jdbc.queryForObject(
                "SELECT COUNT(*) FROM iot_rule WHERE rule_code=?", Integer.class, code);
        if (duplicateCode != null && duplicateCode > 0) {
            throw new IllegalArgumentException("规则标识已存在，请更换后重试");
        }
        try {
            jdbc.update("""
                    INSERT INTO iot_rule
                    (tenant_id,rule_code,rule_name,trigger_text,action_text,enabled,last_trigger,trigger_count)
                    VALUES (?,?,?,?,?,?, '尚未触发',0)
                    """, tenantId, code, name, required(body, "trigger", "请输入触发条件"),
                    required(body, "action", "请输入执行动作"), enabled);
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("规则标识已存在，请更换后重试");
        }
        Map<String, Object> rule = queryOne("""
                SELECT r.*,c.rule_type,c.trigger_metric,c.operator_text,c.threshold_value,
                       c.duration_seconds,c.schedule_text,c.action_device_id,c.action_device_name,
                       c.action_command,c.action_value,c.cooldown_seconds,c.config_json,c.updated_at
                FROM iot_rule r LEFT JOIN iot_rule_config c ON c.rule_id=r.id
                WHERE r.rule_code=?
                """, ruleMapper(), code);
        saveRuleConfig(longObject(rule.get("id")), body);
        addLog("创建自动化规则", name, text(body, "trigger", ""));
        return ruleById(longObject(rule.get("id")));
    }

    @Transactional
    public Map<String, Object> updateRule(long id, Map<String, Object> body) {
        Map<String, Object> existing = requireRule(id);
        validateRuleConfig(body);
        boolean enabled = body.get("enabled") == null
                ? Boolean.TRUE.equals(existing.get("enabled"))
                : Boolean.TRUE.equals(body.get("enabled"));
        jdbc.update("""
                UPDATE iot_rule SET rule_name=?,trigger_text=?,action_text=?,enabled=? WHERE id=?
                """, required(body, "ruleName", "请输入规则名称"),
                required(body, "trigger", "请输入触发条件"),
                required(body, "action", "请输入执行动作"),
                enabled, id);
        saveRuleConfig(id, body);
        addLog("编辑自动化规则", String.valueOf(existing.get("ruleName")),
                text(body, "ruleName", ""));
        return ruleById(id);
    }

    @Transactional
    public Map<String, Object> deleteRule(long id) {
        Map<String, Object> rule = requireRule(id);
        jdbc.update("DELETE FROM iot_rule_config WHERE rule_id=?", id);
        jdbc.update("DELETE FROM iot_rule WHERE id=?", id);
        addLog("删除自动化规则", String.valueOf(rule.get("ruleName")), "规则配置已删除");
        return Map.of("id", id, "ruleName", rule.get("ruleName"));
    }

    /**
     * 手动执行自动化规则。
     *
     * <p>规则会真的驱动设备（开阀、启风机），所以执行前重新按令牌确认规则归属
     * 和执行设备的归属 —— 规则建好之后设备可能已经转卖、改名或删掉，
     * 拿配置里缓存的 action_device_id 直接控制就是越权控制。</p>
     */
    @Transactional
    public Map<String, Object> executeRule(long id) {
        Map<String, Object> rule = requireRule(id);
        if (!Boolean.TRUE.equals(rule.get("enabled"))) {
            throw new IllegalArgumentException("规则已停用，不能执行");
        }
        Long deviceId = longObject(rule.get("actionDeviceId"));
        if (deviceId == null) {
            throw new IllegalArgumentException("规则未配置执行设备，请编辑规则后重试");
        }
        identity.requireDeviceAccess(deviceId);
        String command = required(rule, "actionCommand", "规则未配置执行指令");
        String value = text(rule, "actionValue", "");
        String controlAction = value.isBlank() ? command : command + " " + value;
        controlDevice(deviceId, Map.of("action", controlAction),
                identity.requireOperatorName() + "（自动化规则）");
        jdbc.update("""
                UPDATE iot_rule SET trigger_count=trigger_count+1,last_trigger=? WHERE id=?
                """, nowLabel(), id);
        addLog("手动执行自动化规则", String.valueOf(rule.get("ruleName")), controlAction);
        return ruleById(id);
    }

    @Transactional
    public Map<String, Object> toggleRule(long id) {
        requireRule(id);
        jdbc.update("UPDATE iot_rule SET enabled=NOT enabled WHERE id=?", id);
        return ruleById(id);
    }

    /** 规则归属校验：不在当前主体的规则列表里就按 404 处理，不透露"存在但不是你的"。 */
    private Map<String, Object> requireRule(long id) {
        return rules().stream()
                .filter(item -> longObject(item.get("id")) == id)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("自动化规则不存在：" + id));
    }

    private Map<String, Object> ruleById(long id) {
        return queryOne("""
                SELECT r.*,c.rule_type,c.trigger_metric,c.operator_text,c.threshold_value,
                       c.duration_seconds,c.schedule_text,c.action_device_id,c.action_device_name,
                       c.action_command,c.action_value,c.cooldown_seconds,c.config_json,c.updated_at
                FROM iot_rule r LEFT JOIN iot_rule_config c ON c.rule_id=r.id
                WHERE r.id=? AND r.tenant_id=?
                """, ruleMapper(), id, identity.currentTenantId());
    }

    /**
     * 数据分析报表。
     *
     * <p>改之前这一页只有"设备在线率"和"设备数据量排行"是真的，另外三张卡片
     * （128560 个数据点、326.8m³ 灌溉用水）和整条"近 7 日采集趋势"都是写在 Java 里的常量，
     * 换租户、换时间都一样 —— 页面写着"报表"，实际是一块不会动的展板。
     * 现在四个指标和七根柱子全部由当前主体的遥测/控制记录聚合得出；
     * "灌溉用水"没有计量链路（平台没有接 water meter），改成实打实的控制指令数。</p>
     */
    public Map<String, Object> reports() {
        long tenantId = scopeTenantId();
        List<Map<String, Object>> devices = devices(null, null, null, null);
        long online = devices.stream().filter(d -> "online".equals(d.get("onlineStatus"))).count();
        long alerts = countWhere("SELECT COUNT(*) FROM iot_alert WHERE tenant_id=?",
                new ArrayList<>(List.of(tenantId)));
        List<Object> pointArgs = new ArrayList<>();
        long dataPoints = countWhere("SELECT COUNT(*) FROM iot_telemetry WHERE 1=1"
                + deviceScopeSql("device_id", pointArgs), pointArgs);
        List<Object> controlArgs = new ArrayList<>();
        long controls = countWhere("SELECT COUNT(*) FROM iot_control_log WHERE 1=1"
                + deviceScopeSql("device_id", controlArgs), controlArgs);

        List<Object> dailyArgs = new ArrayList<>();
        String dailyScope = deviceScopeSql("t.device_id", dailyArgs);
        // GROUP BY 用的是完整日期表达式，SELECT 也取完整日期：MySQL 的 only_full_group_by
        // 不认"同一段字符串的另一个子串"是函数依赖，直接在 SELECT 里截 MM-DD 会报语法错。
        List<Map<String, Object>> days = new ArrayList<>(jdbc.query("""
                SELECT SUBSTRING(t.recorded_at,1,10) day,COUNT(*) data FROM iot_telemetry t
                WHERE 1=1""" + dailyScope + """
                 GROUP BY SUBSTRING(t.recorded_at,1,10)
                 ORDER BY SUBSTRING(t.recorded_at,1,10) DESC LIMIT 7
                """, (rs, rowNum) -> map("day", rs.getString("day"), "data", rs.getLong("data")),
                dailyArgs.toArray()));
        java.util.Collections.reverse(days);
        List<Object> controlDailyArgs = new ArrayList<>();
        String controlDailyScope = deviceScopeSql("c.device_id", controlDailyArgs);
        Map<String, Long> controlByDay = new LinkedHashMap<>();
        jdbc.query("""
                SELECT SUBSTRING(c.created_at,1,10) day,COUNT(*) total FROM iot_control_log c
                WHERE 1=1""" + controlDailyScope + """
                 GROUP BY SUBSTRING(c.created_at,1,10)
                """, rs -> {
            controlByDay.put(rs.getString("day"), rs.getLong("total"));
        }, controlDailyArgs.toArray());
        List<Map<String, Object>> daily = days.stream()
                .map(row -> {
                    String day = String.valueOf(row.get("day"));
                    return map(
                            "date", day.length() >= 10 ? day.substring(5) : day,
                            "data", row.get("data"),
                            "control", controlByDay.getOrDefault(day, 0L));
                })
                .toList();

        List<Object> rankArgs = new ArrayList<>();
        String rankScope = deviceScopeSql("t.device_id", rankArgs);
        List<Map<String, Object>> rank = jdbc.query("""
                SELECT d.device_name name,d.type_name type,COUNT(*) readings
                FROM iot_device d JOIN iot_telemetry t ON t.device_id=d.id
                WHERE 1=1""" + rankScope + """
                 GROUP BY d.id,d.device_name,d.type_name ORDER BY readings DESC LIMIT 6
                """, (rs, rowNum) -> map(
                "name", rs.getString("name"), "type", rs.getString("type"), "readings", rs.getLong("readings")),
                rankArgs.toArray());

        return Map.of(
                "summary", Map.of(
                        "dataPoints", dataPoints,
                        "onlineRate", devices.isEmpty() ? 0 : Math.round(online * 1000.0 / devices.size()) / 10.0,
                        "alerts", alerts,
                        "controls", controls
                ),
                "daily", daily,
                "rank", rank
        );
    }

    public List<Map<String, Object>> workOrders() {
        return jdbc.query("""
                SELECT * FROM iot_work_order WHERE tenant_id=?
                ORDER BY CASE status WHEN 'completed' THEN 1 ELSE 0 END,id DESC
                """, workOrderMapper(), scopeTenantId());
    }

    /**
     * 创建运维工单。
     *
     * <p>改之前设备名是前端传什么就存什么，可以给一台不存在的设备、甚至别家的设备开工单，
     * 工单也不记租户，所有主体共用一个列表。现在按当前租户的设备台账解析设备，
     * 租户列取令牌解析出的经营主体。</p>
     */
    @Transactional
    public Map<String, Object> createWorkOrder(Map<String, Object> body) {
        long tenantId = identity.currentTenantId();
        Map<String, Object> device = resolveTenantDevice(body);
        String description = text(body, "description", "");
        if (description.length() > 500) {
            throw new IllegalArgumentException("问题描述不能超过 500 个字符");
        }
        String orderNo = "WO" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"));
        jdbc.update("""
                INSERT INTO iot_work_order
                (tenant_id,order_no,source_name,device_name,order_type,priority,status,technician,description,created_at)
                VALUES (?,?,?,?,?, 'pending',?,?,?,?)
                """, tenantId, orderNo, text(body, "source", "用户报修"), device.get("deviceName"),
                text(body, "orderType", "设备故障"), text(body, "priority", "normal"),
                text(body, "technician", "待智能派单"), description, nowLabel());
        addLog("创建运维工单", orderNo, device.get("deviceName") + " · " + text(body, "orderType", "设备故障"));
        return queryOne("SELECT * FROM iot_work_order WHERE order_no=?", workOrderMapper(), orderNo);
    }

    /** 工单必须挂在当前主体真实存在的设备上：优先按 deviceId 取，兼容只传设备名的老表单。 */
    private Map<String, Object> resolveTenantDevice(Map<String, Object> body) {
        Long deviceId = longObject(body.get("deviceId"));
        if (deviceId != null) {
            identity.requireDeviceAccess(deviceId);
            return queryOne("SELECT * FROM iot_device WHERE id=?", deviceMapper(), deviceId);
        }
        String deviceName = required(body, "deviceName", "请选择设备");
        List<Map<String, Object>> matched = devices(null, null, null, null).stream()
                .filter(item -> deviceName.equals(item.get("deviceName")))
                .toList();
        if (matched.isEmpty()) {
            throw new IllegalArgumentException("设备「" + deviceName + "」不在当前主体的设备台账里，请先在设备管理里注册");
        }
        return matched.get(0);
    }

    public List<Map<String, Object>> firmware() {
        return jdbc.query("SELECT * FROM iot_firmware ORDER BY id DESC", firmwareMapper());
    }

    /** 升级任务：只返回当前主体的（原先全平台混在一起，别家的任务也列在这里）。 */
    public List<Map<String, Object>> otaTasks() {
        return jdbc.query("SELECT * FROM iot_ota_task WHERE tenant_id=? ORDER BY id DESC",
                otaMapper(), scopeTenantId());
    }

    public List<Map<String, Object>> messages() {
        return jdbc.query("SELECT * FROM iot_message WHERE tenant_id=? ORDER BY id DESC",
                messageMapper(), scopeTenantId());
    }

    @Transactional
    public Map<String, Object> readMessage(long id) {
        identity.requireTenantRow("iot_message", id, "消息");
        jdbc.update("UPDATE iot_message SET is_read=TRUE WHERE id=? AND tenant_id=?", id, identity.currentTenantId());
        return queryOne("SELECT * FROM iot_message WHERE id=? AND tenant_id=?", messageMapper(), id, identity.currentTenantId());
    }

    public Map<String, Object> readAllMessages() {
        return Map.of("updated", jdbc.update("UPDATE iot_message SET is_read=TRUE WHERE tenant_id=? AND is_read=FALSE",
                identity.currentTenantId()));
    }

    public Map<String, Object> mobileOverview() {
        Map<String, Object> app = overview();
        return Map.of(
                "stats", app.get("stats"),
                "devices", devices(null, null, null, null).stream().limit(5).toList(),
                "alerts", app.get("alerts"),
                "plots", app.get("plots"),
                "environment", app.get("environment"),
                "messages", messages().stream().limit(3).toList()
        );
    }

    /**
     * 移动端"立即同步"。
     *
     * <p>原先固定回"同步 3 条离线记录"，无论有没有待办都是 3。移动端目前没有离线队列，
     * 同步能做的事情就是把服务端的待办重新拉一遍，所以返回真实计数。</p>
     */
    public Map<String, Object> mobileSync() {
        long tenantId = identity.currentTenantId();
        long pendingWorkOrders = countWhere(
                "SELECT COUNT(*) FROM iot_work_order WHERE tenant_id=? AND status<>'completed'",
                new ArrayList<>(List.of(tenantId)));
        long pendingAlerts = countWhere(
                "SELECT COUNT(*) FROM iot_alert WHERE tenant_id=? AND status<>'resolved'",
                new ArrayList<>(List.of(tenantId)));
        long unreadMessages = countWhere(
                "SELECT COUNT(*) FROM iot_message WHERE tenant_id=? AND is_read=FALSE",
                new ArrayList<>(List.of(tenantId)));
        addLog("移动端同步", "待办数据", "工单 " + pendingWorkOrders + " · 告警 " + pendingAlerts);
        return map(
                "syncedAt", nowLabel(),
                "pendingWorkOrders", pendingWorkOrders,
                "pendingAlerts", pendingAlerts,
                "unreadMessages", unreadMessages,
                "message", "已同步：待办工单 " + pendingWorkOrders + " 条，待处置告警 " + pendingAlerts + " 条");
    }

    private RowMapper<Map<String, Object>> deviceTypeMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "name", rs.getString("type_name"), "category", rs.getString("category_name"),
                "protocol", rs.getString("protocol_name"), "icon", rs.getString("icon_text"),
                "manufacturer", rs.getString("manufacturer"), "model", rs.getString("model_name"),
                "properties", splitCsv(rs.getString("property_text")), "status", rs.getString("status"));
    }

    private RowMapper<Map<String, Object>> groupMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "name", rs.getString("group_name"), "icon", rs.getString("icon_text"),
                "color", rs.getString("color_value"), "deviceCount", rs.getInt("device_count"),
                "isDefault", rs.getBoolean("is_default"));
    }

    private RowMapper<Map<String, Object>> deviceMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "tenantId", rs.getLong("tenant_id"), "farmId", rs.getLong("farm_id"),
                // plot_id / gateway_id / group_id 都可为空：必须用 getObject 取，
                // getLong 会把 NULL 读成 0，前端拿到的就是"地块 0""分组 0"这种假归属
                "plotId", rs.getObject("plot_id"), "gatewayId", rs.getObject("gateway_id"),
                "groupId", rs.getObject("group_id"), "deviceCode", rs.getString("device_code"),
                "deviceName", rs.getString("device_name"), "typeId", rs.getLong("type_id"),
                "typeName", rs.getString("type_name"), "protocol", rs.getString("protocol_name"),
                "onlineStatus", rs.getString("online_status"), "status", rs.getString("status_text"),
                "lastReport", rs.getString("last_report"), "rssi", rs.getObject("signal_strength"),
                "battery", rs.getInt("battery_rate"), "firmwareVersion", rs.getString("firmware_version"),
                "latitude", rs.getBigDecimal("latitude"), "longitude", rs.getBigDecimal("longitude"),
                "controlCapable", rs.getBoolean("control_capable"), "config", rs.getString("config_text"));
    }

    private RowMapper<Map<String, Object>> telemetryMapper() {
        return (rs, rowNum) -> map(
                "key", rs.getString("metric_key"), "name", IotMetrics.metricName(rs.getString("metric_key")),
                "value", rs.getBigDecimal("metric_value"), "unit", rs.getString("unit_name"),
                "recordedAt", rs.getString("recorded_at"));
    }

    private RowMapper<Map<String, Object>> gatewayMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "farmId", rs.getLong("farm_id"), "gatewayCode", rs.getString("gateway_code"),
                "gatewayName", rs.getString("gateway_name"), "model", rs.getString("gateway_model"),
                "protocol", rs.getString("protocol_name"), "firmwareVersion", rs.getString("firmware_version"),
                "ipAddress", rs.getString("ip_address"), "onlineCount", rs.getInt("online_count"),
                "totalCount", rs.getInt("total_count"), "onlineStatus", rs.getString("online_status"),
                "cpuRate", rs.getBigDecimal("cpu_rate"), "memoryRate", rs.getBigDecimal("memory_rate"),
                "lastOnline", rs.getString("last_online"));
    }

    private RowMapper<Map<String, Object>> alertMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "alertNo", rs.getString("alert_no"),
                // device_id 可为空（主体级告警不一定挂在具体设备上）：getLong 会把 NULL 读成 0，
                // 前端就出现"设备 0"这种点进去必然 404 的假链接
                "deviceId", rs.getObject("device_id"),
                "deviceName", rs.getString("device_name"), "type", rs.getString("alert_type"),
                "level", rs.getString("level_name"), "title", rs.getString("title"),
                "content", rs.getString("content"), "triggerValue", rs.getString("trigger_value"),
                "thresholdValue", rs.getString("threshold_value"), "status", rs.getString("status"),
                "handledBy", rs.getString("handled_by"), "handleNote", rs.getString("handle_note"),
                "createdAt", rs.getString("created_at"), "handledAt", rs.getString("handled_at"));
    }

    private RowMapper<Map<String, Object>> alertRuleMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "ruleName", rs.getString("rule_name"),
                "deviceType", rs.getString("device_type"), "metricKey", rs.getString("metric_key"),
                "metricName", rs.getString("metric_name"), "operator", rs.getString("operator_text"),
                "threshold", rs.getString("threshold_value"), "durationSeconds", rs.getInt("duration_seconds"),
                "level", rs.getString("level_name"), "enabled", rs.getBoolean("enabled"),
                "tenantScope", rs.getString("tenant_scope"));
    }

    private RowMapper<Map<String, Object>> sceneMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "sceneCode", rs.getString("scene_code"), "sceneName", rs.getString("scene_name"),
                "icon", rs.getString("icon_text"), "category", rs.getString("category_name"),
                "description", rs.getString("description"), "config", rs.getString("config_text"),
                "active", rs.getBoolean("is_active"), "plotCount", rs.getInt("plot_count"));
    }

    private RowMapper<Map<String, Object>> ruleMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "ruleCode", rs.getString("rule_code"), "ruleName", rs.getString("rule_name"),
                "trigger", rs.getString("trigger_text"), "action", rs.getString("action_text"),
                "enabled", rs.getBoolean("enabled"), "lastTrigger", rs.getString("last_trigger"),
                "triggerCount", rs.getInt("trigger_count"), "ruleType", rs.getString("rule_type"),
                "triggerMetric", rs.getString("trigger_metric"), "operator", rs.getString("operator_text"),
                "threshold", rs.getString("threshold_value"), "durationSeconds", rs.getInt("duration_seconds"),
                "schedule", rs.getString("schedule_text"), "actionDeviceId", rs.getObject("action_device_id"),
                "actionDeviceName", rs.getString("action_device_name"),
                "actionCommand", rs.getString("action_command"), "actionValue", rs.getString("action_value"),
                "cooldownSeconds", rs.getInt("cooldown_seconds"), "config", rs.getString("config_json"),
                "configUpdatedAt", rs.getString("updated_at"));
    }

    private RowMapper<Map<String, Object>> controlLogMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "deviceName", rs.getString("device_name"),
                "action", rs.getString("action_name"), "operator", rs.getString("operator_name"),
                "result", rs.getString("result_text"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> workOrderMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "orderNo", rs.getString("order_no"), "source", rs.getString("source_name"),
                "deviceName", rs.getString("device_name"), "type", rs.getString("order_type"),
                "priority", rs.getString("priority"), "status", rs.getString("status"),
                "technician", rs.getString("technician"), "description", rs.getString("description"),
                "createdAt", rs.getString("created_at"),
                "completedAt", rs.getString("completed_at"));
    }

    private RowMapper<Map<String, Object>> firmwareMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "productName", rs.getString("product_name"),
                "version", rs.getString("version_name"), "fileSize", rs.getString("file_size"),
                "sha256", rs.getString("sha256_text"), "status", rs.getString("status"),
                "releaseAt", rs.getString("release_at"));
    }

    private RowMapper<Map<String, Object>> otaMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "taskNo", rs.getString("task_no"),
                "firmwareVersion", rs.getString("firmware_version"), "targetCount", rs.getInt("target_count"),
                "successCount", rs.getInt("success_count"), "failedCount", rs.getInt("failed_count"),
                "targetScope", rs.getString("target_scope"), "status", rs.getString("status"),
                "executeWindow", rs.getString("execute_window"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> messageMapper() {
        return (rs, rowNum) -> map(
                "id", rs.getLong("id"), "type", rs.getString("message_type"), "title", rs.getString("title"),
                "content", rs.getString("content"), "read", rs.getBoolean("is_read"),
                "createdAt", rs.getString("created_at"));
    }

    private List<String> splitCsv(String text) {
        return text == null || text.isBlank() ? List.of() : List.of(text.split(","));
    }

    private Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }

    private <T> T queryOne(String sql, RowMapper<T> mapper, Object... args) {
        List<T> rows = jdbc.query(sql, mapper, args);
        if (rows.isEmpty()) throw BusinessException.notFound("数据不存在");
        return rows.get(0);
    }

    /** 报表阈值这类可选数值：解析不了就当作没配，不能顺手拼成"经纬度格式无效"。 */
    private BigDecimal decimalOrNull(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private double decimalValue(Object value) {
        BigDecimal parsed = decimalOrNull(value);
        return parsed == null ? 0 : parsed.doubleValue();
    }

    /** 执行设备名称由服务端按台账回填，不接受前端自报（自报的名字会进规则列表和审计）。 */
    private String deviceNameOf(Long deviceId) {
        if (deviceId == null) {
            return "";
        }
        List<String> names = jdbc.queryForList("SELECT device_name FROM iot_device WHERE id=?", String.class, deviceId);
        return names.isEmpty() ? "" : names.get(0);
    }

    private void synchronizeDeviceOwnership(List<Map<String, Object>> currentFarms) {
        List<Object[]> args = currentFarms.stream()
                .map(farm -> new Object[]{
                        longObject(farm.get("tenantId")),
                        longObject(farm.get("id"))
                })
                .filter(values -> values[0] != null && values[1] != null)
                .toList();
        if (!args.isEmpty()) {
            jdbc.batchUpdate("""
                    UPDATE iot_device SET tenant_id=?
                    WHERE farm_id=? AND tenant_id<>?
                    """, args.stream()
                    .map(values -> new Object[]{values[0], values[1], values[0]})
                    .toList());
        }
    }

    private Long longObject(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null ? null : Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private long longValue(Object value, long fallback) {
        try { return value == null ? fallback : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private long requiredLong(Map<String, Object> body, String key, String message) {
        Long value = longObject(body.get(key));
        if (value == null || value <= 0) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private BigDecimal decimalObject(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("经纬度格式无效");
        }
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) throw new IllegalArgumentException(message);
        return value;
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private void validateRuleConfig(Map<String, Object> body) {
        String ruleType = text(body, "ruleType", "automation");
        if ("schedule".equals(ruleType)) {
            required(body, "schedule", "请填写定时表达式");
        } else if (!"offline".equals(ruleType)) {
            String metric = required(body, "triggerMetric", "请选择触发指标");
            if (!"device_offline".equals(metric)) {
                required(body, "operator", "请选择比较方式");
                required(body, "threshold", "请输入触发阈值");
            }
        }
        Long actionDeviceId = longObject(body.get("actionDeviceId"));
        if (actionDeviceId == null) {
            throw new IllegalArgumentException("请选择执行设备");
        }
        identity.requireDeviceAccess(actionDeviceId);
        Map<String, Object> device = queryOne(
                "SELECT * FROM iot_device WHERE id=?", deviceMapper(), actionDeviceId);
        if (!Boolean.TRUE.equals(device.get("controlCapable"))) {
            throw new IllegalArgumentException("执行设备不支持远程控制");
        }
        required(body, "actionCommand", "请选择执行指令");
        if (longValue(body.get("durationSeconds"), 0) < 0
                || longValue(body.get("cooldownSeconds"), 0) < 0) {
            throw new IllegalArgumentException("持续时间和冷却时间不能小于 0");
        }
        validateJson(text(body, "config", "{}"), "规则扩展配置必须是有效的 JSON");
    }

    private void validateJson(String raw, String message) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(raw);
        } catch (Exception ignored) {
            throw new IllegalArgumentException(message);
        }
    }

    private Map<String, Object> gatewayByCode(String code) {
        return gateways().stream()
                .filter(item -> code.equals(item.get("gatewayCode")))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("边缘网关写入后未能读取"));
    }

    private void refreshGatewayCounts(Map<String, Object> gateway) {
        Long gatewayId = longObject(gateway.get("id"));
        if (gatewayId == null) {
            return;
        }
        Map<String, Object> counts = jdbc.queryForMap("""
                SELECT COUNT(*) total_count,
                       COALESCE(SUM(CASE WHEN online_status='online' THEN 1 ELSE 0 END),0) online_count
                FROM iot_device WHERE gateway_id=?
                """, gatewayId);
        int totalCount = (int) longValue(counts.get("total_count"), 0);
        int onlineCount = (int) longValue(counts.get("online_count"), 0);
        jdbc.update("""
                UPDATE iot_gateway SET total_count=?,online_count=? WHERE id=?
                """, totalCount, onlineCount, gatewayId);
        gateway.put("totalCount", totalCount);
        gateway.put("onlineCount", onlineCount);
    }

    private void validateIpAddress(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) {
            return;
        }
        if (!ipAddress.matches("^(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}"
                + "(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)$")) {
            throw new IllegalArgumentException("请输入有效的 IPv4 地址");
        }
    }

    private void saveRuleConfig(Long ruleId, Map<String, Object> body) {
        if (ruleId == null) throw new IllegalArgumentException("自动化规则标识无效");
        jdbc.update("DELETE FROM iot_rule_config WHERE rule_id=?", ruleId);
        jdbc.update("""
                INSERT INTO iot_rule_config
                (rule_id,rule_type,trigger_metric,operator_text,threshold_value,duration_seconds,
                 schedule_text,action_device_id,action_device_name,action_command,action_value,
                 cooldown_seconds,config_json,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, ruleId, text(body, "ruleType", "automation"),
                text(body, "triggerMetric", ""), text(body, "operator", ""),
                text(body, "threshold", ""), (int) longValue(body.get("durationSeconds"), 0),
                text(body, "schedule", ""), longObject(body.get("actionDeviceId")),
                deviceNameOf(longObject(body.get("actionDeviceId"))), text(body, "actionCommand", ""),
                text(body, "actionValue", ""), (int) longValue(body.get("cooldownSeconds"), 0),
                text(body, "config", "{}"), nowLabel());
    }

    private String nowLabel() {
        return LocalDateTime.now().format(TIME);
    }

    /**
     * 运维留痕。
     *
     * <p>操作人取当前登录令牌，来源 IP 取网关传下来的 X-Real-IP / X-Forwarded-For；
     * 原先这里写死"陈建国"，任何人都能在审计里冒充他。</p>
     */
    private void addLog(String action, String target, String detail) {
        jdbc.update("""
                INSERT INTO iot_ops_log (operator_name,action_name,target_name,detail_text,ip_address,created_at)
                VALUES (?,?,?,?,?,?)
                """, identity.requireOperatorName(), action, target, detail, identity.clientIp(), nowLabel());
    }
}
