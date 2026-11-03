package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 平台运营端风控合规：规则阈值配置 + 基于真实数据的风险信号。
 *
 * <p>事件是规则计算结果，必须人工复核，不做自动拦截、扣款或拉黑；
 * 买家信息脱敏展示，规则说明与证据可追溯。</p>
 */
@RestController
@RequestMapping("/api/platform")
@OperatorOnly("s2b2c:read")
public class PlatformRiskController {

    private final JdbcTemplate jdbc;

    public PlatformRiskController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/risk-rules")
    public ResponseEntity<List<Map<String, Object>>> rules() {
        return ResponseEntity.ok(jdbc.queryForList(
                "SELECT code, name, threshold, unit, level, status, action_note AS actionNote, "
                        + "update_time AS updateTime FROM s2b2c_risk_rule ORDER BY level DESC, code"));
    }

    @PutMapping("/risk-rules/{code}")
    public ResponseEntity<Map<String, Object>> updateRule(@PathVariable String code,
                                                          @RequestBody Map<String, Object> body) {
        BigDecimal threshold = decimal(body.get("threshold"), null);
        String status = text(body.get("status")).toUpperCase();
        Map<String, Object> rule = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT code, threshold, status FROM s2b2c_risk_rule WHERE code = ?", code)) {
            rule = row;
        }
        if (rule == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "规则不存在"));
        }
        if (threshold == null || threshold.signum() < 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "阈值必须是不小于 0 的数字"));
        }
        if (!status.isEmpty() && !List.of("ACTIVE", "DISABLED").contains(status)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 ACTIVE / DISABLED"));
        }
        jdbc.update("UPDATE s2b2c_risk_rule SET threshold = ?, status = ? WHERE code = ?",
                threshold, status.isEmpty() ? rule.get("status") : status, code);
        return ResponseEntity.ok(Map.of("success", true, "message", "规则已更新"));
    }

    /** 风险信号：只计算并展示，不执行处置。 */
    @GetMapping("/risk-events")
    public ResponseEntity<Map<String, Object>> events(@RequestParam(required = false) String ruleCode) {
        Map<String, Map<String, Object>> rules = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT code, name, threshold, unit, level, status, action_note AS actionNote FROM s2b2c_risk_rule")) {
            rules.put(String.valueOf(row.get("code")), row);
        }
        LocalDateTime start30 = LocalDate.now().minusDays(29).atStartOfDay();
        List<Map<String, Object>> events = new ArrayList<>();

        Map<String, Object> buyerRule = rules.get("HIGH_REFUND_BUYER");
        if (isActive(buyerRule) && matches(ruleCode, "HIGH_REFUND_BUYER")) {
            BigDecimal threshold = decimal(buyerRule.get("threshold"), new BigDecimal("3"));
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT a.consumer_id AS consumerId, COUNT(*) cnt, IFNULL(SUM(a.amount),0) amount, "
                            + "MAX(a.create_time) lastTime FROM s2b2c_after_sale a "
                            + "WHERE a.status = 'APPROVED' AND a.create_time >= ? "
                            + "GROUP BY a.consumer_id HAVING COUNT(*) >= ?", start30, threshold.intValue())) {
                Map<String, Object> consumer = null;
                for (Map<String, Object> c : jdbc.queryForList(
                        "SELECT nickname, phone FROM s2b2c_consumer WHERE id = ?", row.get("consumerId"))) {
                    consumer = c;
                }
                String name = consumer == null ? "未知买家" : (text(consumer.get("nickname")).isEmpty()
                        ? maskPhone(text(consumer.get("phone"))) : text(consumer.get("nickname")));
                events.add(event("HIGH_REFUND_BUYER", buyerRule,
                        name, "30 天已同意售后 " + row.get("cnt") + " 单，合计 ¥" + row.get("amount"),
                        row.get("lastTime"), decimal(row.get("amount"), BigDecimal.ZERO),
                        "HIGH_REFUND_BUYER:consumer:" + row.get("consumerId")));
            }
        }

        Map<String, Object> quickRule = rules.get("QUICK_REFUND");
        if (isActive(quickRule) && matches(ruleCode, "QUICK_REFUND")) {
            BigDecimal threshold = decimal(quickRule.get("threshold"), new BigDecimal("5"));
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT o.order_no AS orderNo, o.pay_amount AS payAmount, a.amount, a.create_time AS createTime, "
                            + "TIMESTAMPDIFF(MINUTE, o.pay_time, a.create_time) mins "
                            + "FROM s2b2c_after_sale a JOIN s2b2c_order o ON a.order_id = o.id "
                            + "WHERE o.pay_time IS NOT NULL AND a.create_time >= ? "
                            + "AND TIMESTAMPDIFF(MINUTE, o.pay_time, a.create_time) <= ? "
                            + "ORDER BY a.create_time DESC LIMIT 50", start30, threshold.intValue())) {
                events.add(event("QUICK_REFUND", quickRule, text(row.get("orderNo")),
                        "支付后 " + row.get("mins") + " 分钟内申请售后，售后金额 ¥" + row.get("amount"),
                        row.get("createTime"), decimal(row.get("amount"), BigDecimal.ZERO),
                        "QUICK_REFUND:order:" + row.get("orderNo")));
            }
        }

        Map<String, Object> channelRule = rules.get("CHANNEL_AFTER_SALE_RATE");
        if (isActive(channelRule) && matches(ruleCode, "CHANNEL_AFTER_SALE_RATE")) {
            BigDecimal threshold = decimal(channelRule.get("threshold"), new BigDecimal("10"));
            Map<Long, Long> ordersByChannel = new HashMap<>();
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT channel_id, COUNT(*) cnt FROM s2b2c_order WHERE channel_id IS NOT NULL "
                            + "AND status <> 'CANCELLED' AND create_time >= ? GROUP BY channel_id", start30)) {
                ordersByChannel.put(((Number) row.get("channel_id")).longValue(), ((Number) row.get("cnt")).longValue());
            }
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT o.channel_id AS channelId, c.shop_name AS shopName, COUNT(*) cnt "
                            + "FROM s2b2c_after_sale a JOIN s2b2c_order o ON a.order_id = o.id "
                            + "LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id "
                            + "WHERE o.channel_id IS NOT NULL AND a.create_time >= ? GROUP BY o.channel_id, c.shop_name",
                    start30)) {
                Long channelId = ((Number) row.get("channelId")).longValue();
                long orders = ordersByChannel.getOrDefault(channelId, 0L);
                if (orders == 0) continue;
                BigDecimal rate = BigDecimal.valueOf(((Number) row.get("cnt")).longValue())
                        .multiply(new BigDecimal("100"))
                        .divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);
                if (rate.compareTo(threshold) < 0) continue;
                events.add(event("CHANNEL_AFTER_SALE_RATE", channelRule, text(row.get("shopName")),
                        "30 天订单 " + orders + "，售后 " + row.get("cnt") + "，售后率 " + rate + "%",
                        null, BigDecimal.ZERO, "CHANNEL_AFTER_SALE_RATE:channel:" + channelId));
            }
        }

        Map<String, Object> priceRule = rules.get("LOW_PRICE");
        if (isActive(priceRule) && matches(ruleCode, "LOW_PRICE")) {
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT p.id AS productId, cp.channel_id AS channelId, c.shop_name AS shopName, "
                            + "p.name AS productName, p.price AS supplyPrice, cp.retail_price AS retailPrice "
                            + "FROM s2b2c_channel_product cp "
                            + "JOIN s2b2c_product p ON cp.product_id = p.id "
                            + "JOIN s2b2c_channel_partner c ON cp.channel_id = c.id "
                            + "WHERE cp.status = 'ACTIVE' AND cp.retail_price IS NOT NULL "
                            + "AND p.status = 'APPROVED' AND cp.retail_price < p.price")) {
                BigDecimal diff = decimal(row.get("supplyPrice"), BigDecimal.ZERO)
                        .subtract(decimal(row.get("retailPrice"), BigDecimal.ZERO));
                events.add(event("LOW_PRICE", priceRule,
                        text(row.get("productName")) + " · " + text(row.get("shopName")),
                        "渠道价 ¥" + row.get("retailPrice") + " 低于供货价 ¥" + row.get("supplyPrice")
                                + "（差 ¥" + diff + "）", null, diff,
                        "LOW_PRICE:product:" + row.get("productId") + ":channel:" + row.get("channelId")));
            }
        }

        Map<String, Map<String, Object>> actions = new HashMap<>();
        for (Map<String, Object> action : jdbc.queryForList(
                "SELECT event_key AS eventKey, status, remark, operator, update_time AS updateTime "
                        + "FROM s2b2c_risk_event_action")) {
            actions.put(String.valueOf(action.get("eventKey")), action);
        }
        long handled = 0;
        for (Map<String, Object> event : events) {
            Map<String, Object> action = actions.get(String.valueOf(event.get("eventKey")));
            if (action != null) {
                event.put("handleStatus", action.get("status"));
                event.put("handleRemark", action.get("remark"));
                event.put("handleOperator", action.get("operator"));
                event.put("handleTime", action.get("updateTime"));
                handled++;
            } else {
                event.put("handleStatus", "PENDING");
            }
        }
        events.sort(Comparator
                .comparing((Map<String, Object> e) -> "HIGH".equals(e.get("level")) ? 0 : 1)
                .thenComparing(e -> String.valueOf(e.getOrDefault("occurredAt", ""))).reversed());
        long high = events.stream().filter(e -> "HIGH".equals(e.get("level"))).count();
        Map<String, Object> summary = new HashMap<>();
        summary.put("total", events.size());
        summary.put("high", high);
        summary.put("medium", events.size() - high);
        summary.put("activeRules", rules.values().stream().filter(this::isActive).count());
        summary.put("handled", handled);
        Map<String, Object> result = new HashMap<>();
        result.put("records", events);
        result.put("summary", summary);
        result.put("note", "事件由规则计算得出，仅供人工复核；系统不自动拦截、扣款或拉黑。");
        return ResponseEntity.ok(result);
    }

    /** 人工处置：标记已复核或忽略，仅留痕，不触发自动拦截。 */
    @PostMapping("/risk-events/handle")
    public ResponseEntity<Map<String, Object>> handleEvent(@RequestBody Map<String, Object> body) {
        String eventKey = body.get("eventKey") == null ? "" : String.valueOf(body.get("eventKey")).trim();
        String status = body.get("status") == null ? "" : String.valueOf(body.get("status")).trim().toUpperCase();
        String remark = body.get("remark") == null ? "" : String.valueOf(body.get("remark")).trim();
        if (eventKey.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "缺少事件标识"));
        }
        if (!List.of("HANDLED", "IGNORED").contains(status)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "处置结果只能是 HANDLED / IGNORED"));
        }
        jdbc.update("INSERT INTO s2b2c_risk_event_action (id, event_key, status, remark, operator, create_time) "
                        + "VALUES (?,?,?,?, '平台运营', NOW()) ON DUPLICATE KEY UPDATE status = VALUES(status), "
                        + "remark = VALUES(remark), operator = VALUES(operator), update_time = NOW()",
                IdWorker.getId(), eventKey, status, remark);
        return ResponseEntity.ok(Map.of("success", true,
                "message", "HANDLED".equals(status) ? "已标记复核" : "已忽略该事件"));
    }

    private Map<String, Object> event(String ruleCode, Map<String, Object> rule, String subject,
                                      String evidence, Object occurredAt, BigDecimal amount, String eventKey) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventKey", eventKey);
        event.put("ruleCode", ruleCode);
        event.put("ruleName", rule.get("name"));
        event.put("level", rule.get("level"));
        event.put("subject", subject);
        event.put("evidence", evidence);
        event.put("occurredAt", occurredAt);
        event.put("amount", amount);
        event.put("actionNote", rule.get("actionNote"));
        return event;
    }

    private boolean isActive(Map<String, Object> rule) {
        return rule != null && "ACTIVE".equals(String.valueOf(rule.get("status")));
    }

    private boolean matches(String filter, String code) {
        return filter == null || filter.isBlank() || filter.equals(code);
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private BigDecimal decimal(Object value, BigDecimal defaultValue) {
        if (value == null || String.valueOf(value).isBlank()) {
            return defaultValue;
        }
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (RuntimeException e) {
            return defaultValue;
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone == null || phone.isEmpty() ? "未知买家" : phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }
}
