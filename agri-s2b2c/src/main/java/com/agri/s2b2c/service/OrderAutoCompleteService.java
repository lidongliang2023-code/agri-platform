package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 发货后自动确认收货：超过配置天数仍未确认的已发货订单置为已完成，并通知消费者/供货方。
 * 只处理 SHIPPED / PENDING_RECEIVE，取消、退款和待付款订单不受影响。
 */
@Service
public class OrderAutoCompleteService {

    private final JdbcTemplate jdbc;
    private final NoticeService noticeService;

    @Value("${agri.s2b2c.order-auto-complete.days:7}")
    private int defaultDays;

    public OrderAutoCompleteService(JdbcTemplate jdbc, NoticeService noticeService) {
        this.jdbc = jdbc;
        this.noticeService = noticeService;
    }

    public Map<String, Object> completeExpired(int days) {
        int range = days > 0 ? days : defaultDays;
        List<Long> ids = jdbc.queryForList(
                "SELECT o.id FROM s2b2c_order o "
                        + "LEFT JOIN (SELECT order_id, MAX(confirmed_at) confirmed_at FROM s2b2c_order_shipment "
                        + "WHERE status = 'CONFIRMED' GROUP BY order_id) s ON s.order_id = o.id "
                        + "WHERE o.status IN ('SHIPPED','PENDING_RECEIVE') "
                        + "AND COALESCE(s.confirmed_at, o.update_time, o.create_time) < DATE_SUB(NOW(), INTERVAL ? DAY) "
                        + "ORDER BY o.id LIMIT 200", Long.class, range);
        int completed = 0;
        int failed = 0;
        for (Long id : ids) {
            try {
                if (complete(id)) completed++;
            } catch (RuntimeException e) {
                failed++;
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("days", range);
        result.put("scanned", ids.size());
        result.put("completed", completed);
        result.put("failed", failed);
        return result;
    }

    private boolean complete(Long orderId) {
        int updated = jdbc.update("UPDATE s2b2c_order SET status = 'COMPLETED', update_time = NOW() "
                + "WHERE id = ? AND status IN ('SHIPPED','PENDING_RECEIVE')", orderId);
        if (updated == 0) return false;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT order_no AS orderNo, consumer_id AS consumerId, supplier_id AS supplierId, "
                        + "channel_id AS channelId FROM s2b2c_order WHERE id = ?", orderId);
        if (!rows.isEmpty()) {
            Map<String, Object> order = rows.get(0);
            String orderNo = String.valueOf(order.get("orderNo"));
            String text = "订单 " + orderNo + " 已超过确认收货期限，系统已自动确认收货。";
            if (order.get("consumerId") != null) {
                jdbc.update("INSERT INTO s2b2c_message (id, sender_id, receiver_id, receiver_type, type, "
                                + "title, content, is_read, create_time) VALUES (?,?,?,?,?,?,?,0,NOW())",
                        IdWorker.getId(), null, order.get("consumerId"), "CONSUMER", "ORDER",
                        "订单已自动确认收货", text);
            }
            if (order.get("supplierId") != null) {
                noticeService.notify("SUPPLIER", ((Number) order.get("supplierId")).longValue(),
                        "ORDER_COMPLETED", "订单已完成", text, "ORDER", orderId);
            }
            if (order.get("channelId") != null) {
                noticeService.notify("CHANNEL", ((Number) order.get("channelId")).longValue(),
                        "ORDER_COMPLETED", "订单已完成", text, "ORDER", orderId);
            }
        }
        return true;
    }
}