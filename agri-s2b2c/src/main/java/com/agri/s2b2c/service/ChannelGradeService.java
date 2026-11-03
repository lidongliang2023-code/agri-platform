package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 渠道等级考核：按周期内有效渠道订单数与 GMV 匹配门槛，自动升级/降级并留痕。
 *
 * <p>只统计已支付且未取消/退款的订单；等级变化后新订单按新等级取佣金规则，
 * 历史订单佣金不变。规则为空时不执行（避免误把渠道降级）。</p>
 */
@Service
public class ChannelGradeService {

    // 「哪些状态算已支付」由 OrderStatus 定义一次；这里再抄一份就会和结算口径分叉
    private static final List<String> PAID_STATUSES = OrderStatus.PAID_STATUSES;

    private final JdbcTemplate jdbc;
    private final NoticeService noticeService;

    public ChannelGradeService(JdbcTemplate jdbc, NoticeService noticeService) {
        this.jdbc = jdbc;
        this.noticeService = noticeService;
    }

    public List<Map<String, Object>> rules() {
        return jdbc.queryForList(
                "SELECT id, grade, min_orders AS minOrders, min_gmv AS minGmv, status, remark, "
                        + "update_time AS updateTime FROM s2b2c_grade_rule "
                        + "ORDER BY min_gmv DESC, min_orders DESC, grade DESC");
    }

    @Transactional
    public void saveRule(Long id, String grade, int minOrders, BigDecimal minGmv, String status, String remark) {
        jdbc.update("INSERT INTO s2b2c_grade_rule (grade, min_orders, min_gmv, status, remark) "
                        + "VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE min_orders = VALUES(min_orders), "
                        + "min_gmv = VALUES(min_gmv), status = VALUES(status), remark = VALUES(remark)",
                grade, minOrders, minGmv, status, remark);
    }

    public Map<String, Object> evaluate(int days, String operator) {
        return evaluate(days, operator, null);
    }

    @Transactional
    public Map<String, Object> evaluate(int days, String operator, Long onlyChannelId) {
        int range = Math.min(Math.max(days, 1), 365);
        LocalDate endDay = LocalDate.now();
        LocalDate startDay = endDay.minusDays(range - 1L);
        LocalDateTime start = startDay.atStartOfDay();
        LocalDateTime end = endDay.plusDays(1).atStartOfDay();
        List<Map<String, Object>> rules = rules().stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(String.valueOf(row.get("status"))))
                .toList();
        if (rules.isEmpty()) {
            throw new IllegalArgumentException("请先配置等级考核规则");
        }
        List<Map<String, Object>> channels = onlyChannelId == null
                ? jdbc.queryForList(
                        "SELECT id, shop_name AS shopName, grade FROM s2b2c_channel_partner "
                                + "WHERE audit_status = 'APPROVED'")
                : jdbc.queryForList(
                        "SELECT id, shop_name AS shopName, grade FROM s2b2c_channel_partner "
                                + "WHERE audit_status = 'APPROVED' AND id = ?", onlyChannelId);
        int changed = 0;
        int upgrades = 0;
        int downgrades = 0;
        List<Map<String, Object>> changes = new ArrayList<>();
        String placeholders = String.join(",", java.util.Collections.nCopies(PAID_STATUSES.size(), "?"));
        List<Object> args = new ArrayList<>(PAID_STATUSES);
        args.add(start);
        args.add(end);
        for (Map<String, Object> channel : channels) {
            Long channelId = ((Number) channel.get("id")).longValue();
            String currentGrade = String.valueOf(channel.get("grade"));
            List<Object> metricArgs = new ArrayList<>(args);
            metricArgs.add(0, channelId);
            Map<String, Object> metrics = jdbc.queryForMap(
                    "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv FROM s2b2c_order "
                            + "WHERE channel_id = ? AND status IN (" + placeholders + ") "
                            + "AND create_time >= ? AND create_time < ?", metricArgs.toArray());
            int orders = ((Number) metrics.get("orders")).intValue();
            BigDecimal gmv = new BigDecimal(String.valueOf(metrics.get("gmv")));
            Map<String, Object> targetRule = null;
            for (Map<String, Object> rule : rules) {
                int minOrders = ((Number) rule.get("minOrders")).intValue();
                BigDecimal minGmv = new BigDecimal(String.valueOf(rule.get("minGmv")));
                if (orders >= minOrders && gmv.compareTo(minGmv) >= 0) {
                    targetRule = rule;
                    break;
                }
            }
            if (targetRule == null) {
                targetRule = rules.get(rules.size() - 1);
            }
            String targetGrade = String.valueOf(targetRule.get("grade"));
            if (targetGrade.equalsIgnoreCase(currentGrade)) continue;
            jdbc.update("UPDATE s2b2c_channel_partner SET grade = ?, update_time = NOW() WHERE id = ?",
                    targetGrade, channelId);
            jdbc.update("INSERT INTO s2b2c_grade_change_log (id, channel_id, from_grade, to_grade, "
                            + "orders_count, gmv, period_start, period_end, operator, create_time) "
                            + "VALUES (?,?,?,?,?,?,?,?,?,NOW())",
                    IdWorker.getId(), channelId, currentGrade, targetGrade, orders, gmv,
                    startDay, endDay, operator);
            noticeService.notify("CHANNEL", channelId, "GRADE_CHANGED", "渠道等级已调整",
                    "近 " + range + " 天有效订单 " + orders + " 笔、GMV ¥" + gmv.toPlainString()
                            + "，渠道等级由 " + currentGrade + " 调整为 " + targetGrade, "CHANNEL", channelId);
            changed++;
            if (rank(targetGrade) > rank(currentGrade)) upgrades++;
            if (rank(targetGrade) < rank(currentGrade)) downgrades++;
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("channelId", channelId);
            change.put("shopName", channel.get("shopName"));
            change.put("fromGrade", currentGrade);
            change.put("toGrade", targetGrade);
            change.put("orders", orders);
            change.put("gmv", gmv);
            changes.add(change);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("days", range);
        result.put("periodStart", startDay.toString());
        result.put("periodEnd", endDay.toString());
        result.put("evaluated", channels.size());
        result.put("changed", changed);
        result.put("upgrades", upgrades);
        result.put("downgrades", downgrades);
        result.put("changes", changes);
        return result;
    }

    public Map<String, Object> history(Long channelId, int days) {
        int range = Math.min(Math.max(days, 1), 365);
        LocalDate endDay = LocalDate.now();
        LocalDate startDay = endDay.minusDays(range - 1L);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("channelId", channelId);
        List<Map<String, Object>> channel = jdbc.queryForList(
                "SELECT grade FROM s2b2c_channel_partner WHERE id = ?", channelId);
        result.put("currentGrade", channel.isEmpty() ? null : channel.get(0).get("grade"));
        String placeholders = String.join(",", java.util.Collections.nCopies(PAID_STATUSES.size(), "?"));
        List<Object> args = new ArrayList<>(PAID_STATUSES);
        args.add(0, channelId);
        args.add(startDay.atStartOfDay());
        args.add(endDay.plusDays(1).atStartOfDay());
        Map<String, Object> metrics = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv FROM s2b2c_order "
                        + "WHERE channel_id = ? AND status IN (" + placeholders + ") "
                        + "AND create_time >= ? AND create_time < ?", args.toArray());
        result.put("days", range);
        result.put("orders", metrics.get("orders"));
        result.put("gmv", metrics.get("gmv"));
        result.put("rules", rules());
        result.put("changes", jdbc.queryForList(
                "SELECT id, from_grade AS fromGrade, to_grade AS toGrade, orders_count AS orders, gmv, "
                        + "period_start AS periodStart, period_end AS periodEnd, operator, create_time AS createTime "
                        + "FROM s2b2c_grade_change_log WHERE channel_id = ? "
                        + "ORDER BY create_time DESC, id DESC LIMIT 20", channelId));
        return result;
    }

    public List<Map<String, Object>> changes(int limit) {
        int size = Math.min(Math.max(limit, 1), 200);
        return jdbc.queryForList(
                "SELECT l.id, l.channel_id AS channelId, c.shop_name AS shopName, l.from_grade AS fromGrade, "
                        + "l.to_grade AS toGrade, l.orders_count AS orders, l.gmv, l.period_start AS periodStart, "
                        + "l.period_end AS periodEnd, l.operator, l.create_time AS createTime "
                        + "FROM s2b2c_grade_change_log l LEFT JOIN s2b2c_channel_partner c ON c.id = l.channel_id "
                        + "ORDER BY l.create_time DESC, l.id DESC LIMIT ?", size);
    }

    private int rank(String grade) {
        if (grade == null) return 0;
        try {
            return Integer.parseInt(grade.replaceAll("[^0-9]", ""));
        } catch (RuntimeException e) {
            return 0;
        }
    }
}