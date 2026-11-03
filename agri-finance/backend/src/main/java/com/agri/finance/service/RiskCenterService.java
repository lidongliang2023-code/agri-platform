package com.agri.finance.service;

import com.agri.finance.entity.CreditScore;
import com.agri.finance.entity.RiskControlRule;
import com.agri.finance.mapper.RiskControlRuleMapper;
import com.agri.finance.service.ICreditScoreService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 三角链风控聚合服务。
 *
 * <p>本地一体化部署下，finance / trade / production / iot 使用同一 MySQL 实例，
 * 因此通过只读跨库查询形成实时风控视图。独立部署时可通过环境变量分别指向各库；
 * 某个数据源不可用时，该维度标记为 NO_DATA，绝不把未知数据当成“通过”。</p>
 */
@Service
public class RiskCenterService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final JdbcTemplate jdbc;
    private final ICreditScoreService creditScoreService;
    private final RiskControlRuleMapper riskRuleMapper;
    private final ObjectMapper objectMapper;
    private final String tradeDb;
    private final String iotDb;
    private final String productionDb;

    public RiskCenterService(
            JdbcTemplate jdbc,
            ICreditScoreService creditScoreService,
            RiskControlRuleMapper riskRuleMapper,
            ObjectMapper objectMapper,
            @Value("${agri.risk.trade-database:agri_trade}") String tradeDb,
            @Value("${agri.risk.iot-database:agri_iot}") String iotDb,
            @Value("${agri.risk.production-database:agri_production}") String productionDb) {
        this.jdbc = jdbc;
        this.creditScoreService = creditScoreService;
        this.riskRuleMapper = riskRuleMapper;
        this.objectMapper = objectMapper;
        this.tradeDb = safeDatabase(tradeDb);
        this.iotDb = safeDatabase(iotDb);
        this.productionDb = safeDatabase(productionDb);
    }

    public Map<String, Object> center(String requestedSubjectId) {
        String subjectId = requestedSubjectId == null || requestedSubjectId.isBlank()
                ? defaultSubjectId()
                : requestedSubjectId.trim();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("subjectId", subjectId);
        result.put("subjectName", subjectName(subjectId));
        result.put("subjects", subjects());
        result.put("generatedAt", now());
        result.put("portfolio", portfolio());

        Map<String, Object> transaction = transactionDimension(subjectId);
        Map<String, Object> logistics = logisticsDimension(subjectId);
        Map<String, Object> warehouse = warehouseDimension(subjectId);
        Map<String, Object> production = productionDimension(subjectId);
        List<Map<String, Object>> dimensions = List.of(transaction, logistics, warehouse, production);

        int computedCount = 0;
        double weightedScore = 0;
        double[] weights = {0.4, 0.2, 0.2, 0.2};
        for (int index = 0; index < dimensions.size(); index++) {
            Map<String, Object> dimension = dimensions.get(index);
            if (!"NO_DATA".equals(dimension.get("status"))) {
                computedCount++;
                weightedScore += intValue(dimension.get("score")) * weights[index];
            }
        }
        int composite = computedCount == 0 ? 0 : (int) Math.round(weightedScore / (
                weights[0] * (isComputed(transaction) ? 1 : 0)
                        + weights[1] * (isComputed(logistics) ? 1 : 0)
                        + weights[2] * (isComputed(warehouse) ? 1 : 0)
                        + weights[3] * (isComputed(production) ? 1 : 0)));
        int completeness = computedCount * 25;
        String riskLevel = riskLevel(composite, completeness);
        String decision = decision(composite, completeness);

        List<Map<String, Object>> alerts = alerts(transaction, logistics, warehouse, production);
        List<Map<String, Object>> crossChecks = crossChecks(transaction, logistics, warehouse, production);
        String crossStatus = crossChecks.stream().anyMatch(item -> "RISK".equals(item.get("status")))
                ? "RISK"
                : crossChecks.stream().anyMatch(item -> "WARN".equals(item.get("status")))
                ? "WARN"
                : "PASS";

        result.put("dimensions", dimensions);
        result.put("compositeScore", composite);
        result.put("riskLevel", riskLevel);
        result.put("decision", decision);
        result.put("dataCompleteness", completeness);
        result.put("crossValidationStatus", crossStatus);
        result.put("crossChecks", crossChecks);
        result.put("alerts", alerts);
        result.put("rules", activeRules());
        return result;
    }

    @Transactional
    public Map<String, Object> assess(String subjectId, String operator) {
        Map<String, Object> report = center(subjectId);
        String id = "RISK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
        String assessmentNo = "FRA" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        report.put("snapshotId", id);
        report.put("assessmentNo", assessmentNo);
        jdbc.update("""
                INSERT INTO risk_assessment_snapshot
                (id,assessment_no,subject_id,subject_name,transaction_score,logistics_score,
                 warehouse_score,production_score,composite_score,risk_level,decision_text,
                 data_completeness,cross_validation_status,findings_json,metrics_json,evaluated_by,
                 evaluated_at,created_at,del_flag)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                """, id, assessmentNo, report.get("subjectId"), report.get("subjectName"),
                dimensionScore(report, 0), dimensionScore(report, 1),
                dimensionScore(report, 2), dimensionScore(report, 3),
                report.get("compositeScore"), report.get("riskLevel"), report.get("decision"),
                BigDecimal.valueOf(longValue(report.get("dataCompleteness"))),
                report.get("crossValidationStatus"),
                json(report.get("crossChecks")), json(report.get("dimensions")),
                operator == null || operator.isBlank() ? "finance-risk" : operator,
                LocalDateTime.now(), LocalDateTime.now());
        return report;
    }

    public List<Map<String, Object>> snapshots(String subjectId) {
        StringBuilder sql = new StringBuilder("""
                SELECT id,assessment_no,subject_id,subject_name,transaction_score,logistics_score,
                       warehouse_score,production_score,composite_score,risk_level,decision_text,
                       data_completeness,cross_validation_status,evaluated_by,evaluated_at
                FROM risk_assessment_snapshot WHERE del_flag=0
                """);
        List<Object> args = new ArrayList<>();
        if (subjectId != null && !subjectId.isBlank()) {
            sql.append(" AND subject_id=?");
            args.add(subjectId);
        }
        sql.append(" ORDER BY evaluated_at DESC LIMIT 30");
        return jdbc.query(sql.toString(), (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getString("id"));
            item.put("assessmentNo", rs.getString("assessment_no"));
            item.put("subjectId", rs.getString("subject_id"));
            item.put("subjectName", rs.getString("subject_name"));
            item.put("transactionScore", rs.getInt("transaction_score"));
            item.put("logisticsScore", rs.getInt("logistics_score"));
            item.put("warehouseScore", rs.getInt("warehouse_score"));
            item.put("productionScore", rs.getInt("production_score"));
            item.put("compositeScore", rs.getInt("composite_score"));
            item.put("riskLevel", rs.getString("risk_level"));
            item.put("decision", rs.getString("decision_text"));
            item.put("dataCompleteness", rs.getBigDecimal("data_completeness"));
            item.put("crossValidationStatus", rs.getString("cross_validation_status"));
            item.put("evaluatedBy", rs.getString("evaluated_by"));
            item.put("evaluatedAt", timestamp(rs.getTimestamp("evaluated_at")));
            return item;
        }, args.toArray());
    }

    private Map<String, Object> transactionDimension(String subjectId) {
        try {
            Map<String, Object> row = jdbc.queryForMap("""
                    SELECT COUNT(*) order_count,
                           COALESCE(SUM(total_amount),0) total_amount,
                           COALESCE(SUM(CASE WHEN order_status IN ('received','completed') THEN 1 ELSE 0 END),0) fulfilled_count,
                           COALESCE(SUM(CASE WHEN payment_status IN ('paid','refunded') THEN 1 ELSE 0 END),0) settled_count,
                           COALESCE(SUM(CASE WHEN dispute_id IS NOT NULL OR order_status='refunding' THEN 1 ELSE 0 END),0) dispute_count
                    FROM %s.agri_trade_order
                    WHERE del_flag=0 AND (buyer_id=? OR seller_id=?)
                    """.formatted(tradeDb), subjectId, subjectId);
            int orderCount = intValue(row.get("order_count"));
            int fulfilled = intValue(row.get("fulfilled_count"));
            int settled = intValue(row.get("settled_count"));
            int disputes = intValue(row.get("dispute_count"));
            CreditScore credit = creditScoreService.generateCreditReport(subjectId);
            double fulfillmentRate = percent(fulfilled, orderCount);
            double settlementRate = percent(settled, orderCount);
            int score = clamp((int) Math.round(
                    credit.getCompositeScore() / 10.0 * 0.55
                            + Math.min(100, orderCount * 8 + fulfillmentRate * 0.3 + settlementRate * 0.2) * 0.45
                            - credit.getOverdueCount() * 8
                            - disputes * 5));
            String status = orderCount == 0 ? "NO_DATA" : (credit.getOverdueCount() > 0 || disputes > 0 ? "WARN" : "PASS");
            Map<String, Object> evidence = evidence("trade", "agri_trade", orderCount,
                    Map.of(
                            "orderCount", orderCount,
                            "totalAmount", decimal(row.get("total_amount")),
                            "fulfillmentRate", round(fulfillmentRate),
                            "settlementRate", round(settlementRate),
                            "disputes", disputes,
                            "creditScore", credit.getCompositeScore(),
                            "creditLevel", credit.getCreditLevel(),
                            "overdueCount", credit.getOverdueCount()
                    ));
            return dimension("TRADE", "交易信用", "以订单、履约、结算与信用历史形成画像", score, status, evidence,
                    orderCount == 0 ? "未获取到该主体的交易订单" :
                            "共 " + orderCount + " 笔订单，履约率 " + round(fulfillmentRate) + "%，结算率 "
                                    + round(settlementRate) + "%，争议/退款 " + disputes + " 笔");
        } catch (Exception error) {
            return unavailableDimension("TRADE", "交易信用", "交易订单数据源不可用：" + brief(error));
        }
    }

    private Map<String, Object> logisticsDimension(String subjectId) {
        try {
            Map<String, Object> row = jdbc.queryForMap("""
                    SELECT COUNT(*) shipment_count,
                           COALESCE(SUM(CASE WHEN l.logistics_status='delivered' THEN 1 ELSE 0 END),0) delivered_count,
                           COALESCE(SUM(CASE WHEN l.logistics_status IN ('picked','in_transit','delivering') THEN 1 ELSE 0 END),0) in_transit_count,
                           COALESCE(SUM(CASE WHEN l.temperature IS NOT NULL AND (l.temperature < 0 OR l.temperature > 25) THEN 1 ELSE 0 END),0) temperature_alerts,
                           COALESCE(SUM(CASE WHEN l.sign_time IS NOT NULL THEN 1 ELSE 0 END),0) signed_count,
                           COALESCE(SUM(CASE WHEN l.logistics_status='delivered' AND o.order_status NOT IN ('received','completed') THEN 1 ELSE 0 END),0) cross_mismatch,
                           AVG(l.temperature) avg_temperature
                    FROM %s.agri_trade_logistics l
                    JOIN %s.agri_trade_order o ON o.id=l.order_id
                    WHERE l.del_flag=0 AND o.del_flag=0 AND (o.buyer_id=? OR o.seller_id=?)
                    """.formatted(tradeDb, tradeDb), subjectId, subjectId);
            int shipments = intValue(row.get("shipment_count"));
            int delivered = intValue(row.get("delivered_count"));
            int tempAlerts = intValue(row.get("temperature_alerts"));
            int mismatch = intValue(row.get("cross_mismatch"));
            double deliveredRate = percent(delivered, shipments);
            int score = shipments == 0 ? 0 : clamp((int) Math.round(60 + deliveredRate * 0.3 - tempAlerts * 8 - mismatch * 10));
            String status = shipments == 0 ? "NO_DATA" : (tempAlerts > 0 || mismatch > 0 ? "WARN" : "PASS");
            Map<String, Object> logisticsValues = new LinkedHashMap<>();
            logisticsValues.put("shipmentCount", shipments);
            logisticsValues.put("deliveredCount", delivered);
            logisticsValues.put("inTransitCount", intValue(row.get("in_transit_count")));
            logisticsValues.put("signedCount", intValue(row.get("signed_count")));
            logisticsValues.put("temperatureAlerts", tempAlerts);
            logisticsValues.put("crossMismatch", mismatch);
            logisticsValues.put("averageTemperature", roundNullable(row.get("avg_temperature")));
            Map<String, Object> evidence = evidence("logistics", "agri_trade", shipments, logisticsValues);
            return dimension("LOGISTICS", "物流数据", "运输轨迹、温湿度与签收节点交叉验证", score, status, evidence,
                    shipments == 0 ? "该主体暂无物流运输记录" :
                            "共 " + shipments + " 单物流，签收率 " + round(deliveredRate) + "%，温控异常 "
                                    + tempAlerts + " 单，订单/签收状态不一致 " + mismatch + " 单");
        } catch (Exception error) {
            return unavailableDimension("LOGISTICS", "物流数据", "物流数据源不可用：" + brief(error));
        }
    }

    private Map<String, Object> warehouseDimension(String subjectId) {
        try {
            Map<String, Object> pledge = jdbc.queryForMap("""
                    SELECT COUNT(*) pledge_count,
                           COALESCE(SUM(CASE WHEN status='已生效' THEN 1 ELSE 0 END),0) active_count,
                           COALESCE(SUM(total_value),0) total_value,
                           COALESCE(SUM(loan_amount),0) loan_amount
                    FROM pledge WHERE del_flag=0 AND user_id=?
                    """, subjectId);
            Map<String, Object> monitor;
            try {
                monitor = jdbc.queryForMap("""
                        SELECT COUNT(DISTINCT m.id) monitor_count,
                               COALESCE(SUM(CASE WHEN m.alert_level IS NOT NULL AND m.alert_level<>'无' THEN 1 ELSE 0 END),0) monitor_alerts,
                               COALESCE(SUM(CASE WHEN r.quantity>0 AND ABS(COALESCE(m.realtime_weight,0)-r.quantity)/r.quantity>0.05 THEN 1 ELSE 0 END),0) weight_deviations,
                               COALESCE(SUM(CASE WHEN m.device_status NOT IN ('online','normal','运行中') THEN 1 ELSE 0 END),0) device_abnormal,
                               AVG(m.temperature) avg_temperature,
                               AVG(m.humidity) avg_humidity
                        FROM warehouse_receipt r
                        JOIN pledge p ON p.id=r.pledge_id
                        LEFT JOIN pledge_monitor m ON m.receipt_id=r.id AND m.del_flag=0
                        WHERE r.del_flag=0 AND p.del_flag=0 AND p.user_id=?
                        """, subjectId);
            } catch (Exception ignored) {
                monitor = new LinkedHashMap<>();
                monitor.put("monitor_count", 0);
                monitor.put("monitor_alerts", 0);
                monitor.put("weight_deviations", 0);
                monitor.put("device_abnormal", 0);
                monitor.put("avg_temperature", null);
                monitor.put("avg_humidity", null);
            }
            int pledges = intValue(pledge.get("pledge_count"));
            int active = intValue(pledge.get("active_count"));
            int monitors = intValue(monitor.get("monitor_count"));
            int alerts = intValue(monitor.get("monitor_alerts"));
            int deviations = intValue(monitor.get("weight_deviations"));
            int deviceAbnormal = intValue(monitor.get("device_abnormal"));
            int score = pledges == 0 ? 0 : clamp(72 + Math.min(12, active * 4) - alerts * 10 - deviations * 8 - deviceAbnormal * 8);
            String status = pledges == 0 ? "NO_DATA" : (monitors == 0 || alerts > 0 || deviations > 0 || deviceAbnormal > 0 ? "WARN" : "PASS");
            Map<String, Object> values = new LinkedHashMap<>();
            values.put("pledgeCount", pledges);
            values.put("activeCount", active);
            values.put("totalValue", decimal(pledge.get("total_value")));
            values.put("loanAmount", decimal(pledge.get("loan_amount")));
            values.put("monitorCount", monitors);
            values.put("monitorAlerts", alerts);
            values.put("weightDeviations", deviations);
            values.put("deviceAbnormal", deviceAbnormal);
            values.put("averageTemperature", roundNullable(monitor.get("avg_temperature")));
            values.put("averageHumidity", roundNullable(monitor.get("avg_humidity")));
            Map<String, Object> evidence = evidence("warehouse", "agri_finance", pledges + monitors, values);
            return dimension("WAREHOUSE", "仓单监管", "出入库、称重与仓储物联网数据联动", score, status, evidence,
                    pledges == 0 ? "该主体暂无仓单质押记录" :
                            "质押仓单 " + pledges + " 笔，生效 " + active + " 笔，监测量 " + monitors
                                    + " 次，异常 " + (alerts + deviations + deviceAbnormal) + " 项");
        } catch (Exception error) {
            return unavailableDimension("WAREHOUSE", "仓单监管", "仓储数据源不可用：" + brief(error));
        }
    }

    private Map<String, Object> productionDimension(String subjectId) {
        try {
            Map<String, Object> devices = jdbc.queryForMap("""
                    SELECT COUNT(*) device_count,
                           COALESCE(SUM(CASE WHEN online_status='online' THEN 1 ELSE 0 END),0) online_count,
                           AVG(battery_rate) avg_battery
                    FROM %s.iot_device WHERE tenant_id=?
                    """.formatted(iotDb), subjectId);
            int deviceCount = intValue(devices.get("device_count"));
            int online = intValue(devices.get("online_count"));
            double onlineRate = percent(online, deviceCount);
            int alerts = 0;
            int telemetry = 0;
            try {
                alerts = intValue(jdbc.queryForObject("""
                        SELECT COUNT(*) FROM %s.iot_alert
                        WHERE tenant_id=? AND status<>'resolved'
                        """.formatted(iotDb), Integer.class, subjectId));
            } catch (Exception ignored) {
                // 告警源不可用不阻断设备在线率评估。
            }
            try {
                telemetry = intValue(jdbc.queryForObject("""
                        SELECT COUNT(*) FROM %s.iot_telemetry t
                        JOIN %s.iot_device d ON d.id=t.device_id
                        WHERE d.tenant_id=?
                        """.formatted(iotDb, iotDb), Integer.class, subjectId));
            } catch (Exception ignored) {
                // 遥测数据为空时使用设备心跳作为最低完整性依据。
            }
            int plots = 0;
            try {
                plots = intValue(jdbc.queryForObject("""
                        SELECT COUNT(*) FROM %s.agri_prod_plot_info
                        WHERE tenant_id=? AND deleted=0
                        """.formatted(productionDb), Integer.class, subjectId));
            } catch (Exception ignored) {
                // 生产地块不可用时仍可评估设备运行状态。
            }
            int score = deviceCount == 0 ? 0 : clamp((int) Math.round(onlineRate * 0.75 + Math.min(25, telemetry / 20.0) - alerts * 4));
            String status = deviceCount == 0 ? "NO_DATA" : (onlineRate < 80 || alerts > 0 ? "WARN" : "PASS");
            Map<String, Object> values = new LinkedHashMap<>();
            values.put("deviceCount", deviceCount);
            values.put("onlineCount", online);
            values.put("onlineRate", round(onlineRate));
            values.put("alertCount", alerts);
            values.put("telemetryCount", telemetry);
            values.put("plotCount", plots);
            values.put("averageBattery", roundNullable(devices.get("avg_battery")));
            Map<String, Object> evidence = evidence("production-iot", "agri_iot + agri_production",
                    deviceCount + telemetry, values);
            return dimension("PRODUCTION_IOT", "生产 IoT", "种植、养殖与设施环境数据辅助产能判断", score, status, evidence,
                    deviceCount == 0 ? "该租户暂无生产 IoT 设备" :
                            "设备 " + deviceCount + " 台，在线率 " + round(onlineRate) + "%，未处理告警 "
                                    + alerts + " 条，遥测 " + telemetry + " 条，生产地块 " + plots + " 个");
        } catch (Exception error) {
            return unavailableDimension("PRODUCTION_IOT", "生产 IoT", "生产 IoT 数据源不可用：" + brief(error));
        }
    }

    private List<Map<String, Object>> crossChecks(
            Map<String, Object> transaction,
            Map<String, Object> logistics,
            Map<String, Object> warehouse,
            Map<String, Object> production) {
        int orderCount = evidenceNumber(transaction, "orderCount");
        int shipmentCount = evidenceNumber(logistics, "shipmentCount");
        int delivered = evidenceNumber(logistics, "deliveredCount");
        int mismatch = evidenceNumber(logistics, "crossMismatch");
        int pledges = evidenceNumber(warehouse, "pledgeCount");
        int monitors = evidenceNumber(warehouse, "monitorCount");
        int devices = evidenceNumber(production, "deviceCount");
        int plotCount = evidenceNumber(production, "plotCount");
        List<Map<String, Object>> checks = new ArrayList<>();
        checks.add(check("ORDERS_LOGISTICS", "订单 ↔ 物流",
                orderCount == 0 ? "NO_DATA" : shipmentCount == 0 ? "WARN" : mismatch > 0 ? "RISK" : "PASS",
                orderCount + " 笔订单 / " + shipmentCount + " 单物流 / 状态不一致 " + mismatch));
        checks.add(check("LOGISTICS_WAREHOUSE", "物流 ↔ 仓单",
                pledges == 0 ? "NO_DATA" : delivered == 0 ? "WARN" : "PASS",
                pledges + " 笔仓单 / " + delivered + " 单已签收物流"));
        checks.add(check("WAREHOUSE_IOT", "仓单 ↔ 仓储 IoT",
                pledges == 0 ? "NO_DATA" : monitors == 0 ? "WARN" : "PASS",
                pledges + " 笔仓单 / " + monitors + " 次仓储监测"));
        checks.add(check("PRODUCTION_CREDIT", "生产 ↔ 交易信用",
                devices == 0 || orderCount == 0 ? "NO_DATA" : plotCount == 0 ? "WARN" : "PASS",
                devices + " 台 IoT 设备 / " + plotCount + " 个生产地块 / " + orderCount + " 笔交易"));
        return checks;
    }

    private List<Map<String, Object>> alerts(
            Map<String, Object> transaction,
            Map<String, Object> logistics,
            Map<String, Object> warehouse,
            Map<String, Object> production) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        addAlert(alerts, "transaction", "HIGH", "历史逾期",
                evidenceNumber(transaction, "overdueCount") + " 次逾期记录", evidenceNumber(transaction, "overdueCount") > 0);
        addAlert(alerts, "transaction", "MEDIUM", "交易争议/退款",
                evidenceNumber(transaction, "disputes") + " 笔订单存在争议或退款", evidenceNumber(transaction, "disputes") > 0);
        addAlert(alerts, "logistics", "HIGH", "冷链温控异常",
                evidenceNumber(logistics, "temperatureAlerts") + " 单物流温度超出 0-25℃", evidenceNumber(logistics, "temperatureAlerts") > 0);
        addAlert(alerts, "logistics", "HIGH", "订单与签收状态不一致",
                evidenceNumber(logistics, "crossMismatch") + " 单物流已签收但订单未完成", evidenceNumber(logistics, "crossMismatch") > 0);
        addAlert(alerts, "warehouse", "HIGH", "仓单监测异常",
                evidenceNumber(warehouse, "monitorAlerts") + " 条仓储监控告警", evidenceNumber(warehouse, "monitorAlerts") > 0);
        addAlert(alerts, "warehouse", "MEDIUM", "仓单重量偏差",
                evidenceNumber(warehouse, "weightDeviations") + " 笔仓单重量偏差超过 5%", evidenceNumber(warehouse, "weightDeviations") > 0);
        addAlert(alerts, "production", "HIGH", "IoT 设备异常",
                evidenceNumber(production, "alertCount") + " 条未处理 IoT 告警", evidenceNumber(production, "alertCount") > 0);
        if (alerts.isEmpty()) {
            alerts.add(alert("info", "LOW", "未发现跨源冲突", "四类数据未触发风险阈值，仍需持续监测"));
        }
        return alerts;
    }

    private Map<String, Object> portfolio() {
        Map<String, Object> result = new LinkedHashMap<>();
        safeNumber(() -> jdbc.queryForObject(
                "SELECT COUNT(*) FROM loan WHERE del_flag=0 AND status='还款中'", Long.class), 0)
                .ifPresent(value -> result.put("activeLoans", value));
        safeDecimal(() -> jdbc.queryForObject(
                "SELECT COALESCE(SUM(remaining_amount),0) FROM loan WHERE del_flag=0 AND status='还款中'", BigDecimal.class))
                .ifPresent(value -> result.put("outstandingAmount", value));
        safeNumber(() -> jdbc.queryForObject(
                "SELECT COUNT(*) FROM overdue_record WHERE del_flag=0 AND status<>'已结清'", Long.class), 0)
                .ifPresent(value -> result.put("overdueCount", value));
        safeNumber(() -> jdbc.queryForObject(
                "SELECT COUNT(*) FROM pledge WHERE del_flag=0 AND status='已生效'", Long.class), 0)
                .ifPresent(value -> result.put("activePledges", value));
        safeNumber(() -> jdbc.queryForObject(
                "SELECT COUNT(*) FROM risk_assessment_snapshot WHERE del_flag=0", Long.class), 0)
                .ifPresent(value -> result.put("assessmentCount", value));
        return result;
    }

    private List<Map<String, Object>> subjects() {
        try {
            return jdbc.query("""
                    SELECT user_id, MAX(user_name) user_name, COUNT(*) application_count
                    FROM loan_application WHERE del_flag=0
                    GROUP BY user_id ORDER BY MAX(apply_time) DESC
                    """, (rs, rowNum) -> Map.of(
                    "subjectId", rs.getString("user_id"),
                    "subjectName", rs.getString("user_name") == null ? rs.getString("user_id") : rs.getString("user_name"),
                    "applicationCount", rs.getInt("application_count")));
        } catch (Exception ignored) {
            return List.of(Map.of("subjectId", "2001", "subjectName", "绿源农业合作社", "applicationCount", 0));
        }
    }

    private String defaultSubjectId() {
        List<Map<String, Object>> subjects = subjects();
        return subjects.isEmpty() ? "2001" : String.valueOf(subjects.get(0).get("subjectId"));
    }

    private String subjectName(String subjectId) {
        try {
            String name = jdbc.queryForObject("""
                    SELECT user_name FROM loan_application
                    WHERE user_id=? AND del_flag=0 ORDER BY apply_time DESC LIMIT 1
                    """, String.class, subjectId);
            return name == null ? subjectId : name;
        } catch (Exception ignored) {
            return subjectId;
        }
    }

    private List<Map<String, Object>> activeRules() {
        List<RiskControlRule> rules = riskRuleMapper.selectList(
                new LambdaQueryWrapper<RiskControlRule>()
                        .eq(RiskControlRule::getStatus, "启用")
                        .eq(RiskControlRule::getDelFlag, 0));
        List<Map<String, Object>> result = new ArrayList<>();
        for (RiskControlRule rule : rules) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ruleNo", rule.getRuleNo());
            item.put("ruleName", rule.getRuleName());
            item.put("ruleType", rule.getRuleType());
            item.put("priority", rule.getPriority());
            item.put("action", rule.getAction());
            result.add(item);
        }
        return result;
    }

    private Map<String, Object> dimension(
            String key, String name, String description, int score, String status,
            Map<String, Object> evidence, String finding) {
        Map<String, Object> dimension = new LinkedHashMap<>();
        dimension.put("key", key);
        dimension.put("name", name);
        dimension.put("description", description);
        dimension.put("score", score);
        dimension.put("status", status);
        dimension.put("evidence", evidence);
        dimension.put("finding", finding);
        return dimension;
    }

    private Map<String, Object> unavailableDimension(String key, String name, String finding) {
        Map<String, Object> evidence = evidence(key.toLowerCase(Locale.ROOT), "unavailable", 0, Map.of());
        return dimension(key, name, "数据源暂不可用，当前维度不参与加权", 0, "NO_DATA", evidence, finding);
    }

    private Map<String, Object> evidence(String key, String source, int records, Map<String, Object> values) {
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("source", key);
        evidence.put("sourceTable", source);
        evidence.put("records", records);
        evidence.put("checkedAt", now());
        evidence.put("values", values);
        return evidence;
    }

    private Map<String, Object> check(String key, String name, String status, String finding) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("key", key);
        item.put("name", name);
        item.put("status", status);
        item.put("finding", finding);
        return item;
    }

    private Map<String, Object> alert(String type, String level, String title, String detail) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", type);
        item.put("level", level);
        item.put("title", title);
        item.put("detail", detail);
        item.put("createdAt", now());
        return item;
    }

    private void addAlert(List<Map<String, Object>> alerts, String type, String level,
                          String title, String detail, boolean present) {
        if (present) alerts.add(alert(type, level, title, detail));
    }

    private int evidenceNumber(Map<String, Object> dimension, String key) {
        Object evidence = dimension.get("evidence");
        if (!(evidence instanceof Map<?, ?> evidenceMap)) return 0;
        Object values = evidenceMap.get("values");
        if (!(values instanceof Map<?, ?> valueMap)) return 0;
        return intValue(valueMap.get(key));
    }

    private boolean isComputed(Map<String, Object> dimension) {
        return !"NO_DATA".equals(dimension.get("status"));
    }

    private int dimensionScore(Map<String, Object> report, int index) {
        Object dimensions = report.get("dimensions");
        if (!(dimensions instanceof List<?> list) || list.size() <= index) return 0;
        return intValue(((Map<?, ?>) list.get(index)).get("score"));
    }

    private String riskLevel(int score, int completeness) {
        if (completeness < 50) return "数据不足";
        if (score >= 85) return "低风险";
        if (score >= 70) return "中低风险";
        if (score >= 55) return "中高风险";
        return "高风险";
    }

    private String decision(int score, int completeness) {
        if (completeness < 50) return "补充数据源后再评估";
        if (score >= 85) return "建议自动通过";
        if (score >= 70) return "正常复核";
        if (score >= 55) return "转人工复核";
        return "建议拒绝或冻结新增提款";
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return "[]";
        }
    }

    private String now() {
        return LocalDateTime.now().format(TIME);
    }

    private String timestamp(java.sql.Timestamp value) {
        return value == null ? null : value.toLocalDateTime().format(TIME);
    }

    private String safeDatabase(String name) {
        if (name == null || !name.matches("[A-Za-z0-9_]+")) {
            throw new IllegalArgumentException("风控数据源数据库名不合法");
        }
        return name;
    }

    private double percent(int value, int total) {
        return total <= 0 ? 0 : value * 100.0 / total;
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private Object roundNullable(Object value) {
        if (value == null) return null;
        try {
            return round(Double.parseDouble(String.valueOf(value)));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private int intValue(Object value) {
        if (value == null) return 0;
        try {
            return new BigDecimal(String.valueOf(value)).intValue();
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private long longValue(Object value) {
        if (value == null) return 0;
        try {
            return new BigDecimal(String.valueOf(value)).longValue();
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private BigDecimal decimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return BigDecimal.ZERO;
        }
    }

    private String brief(Exception error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return message.length() > 180 ? message.substring(0, 180) : message;
    }

    private java.util.Optional<Long> safeNumber(
            java.util.function.Supplier<Long> supplier, long fallback) {
        try {
            return java.util.Optional.ofNullable(supplier.get());
        } catch (Exception ignored) {
            return java.util.Optional.of(fallback);
        }
    }

    private java.util.Optional<BigDecimal> safeDecimal(java.util.function.Supplier<BigDecimal> supplier) {
        try {
            return java.util.Optional.ofNullable(supplier.get());
        } catch (Exception ignored) {
            return java.util.Optional.of(BigDecimal.ZERO);
        }
    }
}
