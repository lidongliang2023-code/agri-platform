package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 取消待付款订单：状态条件更新 + 权益回补 + 取消通知。
 */
@Service
public class OrderCancellationService {

    private final JdbcTemplate jdbc;
    private final OrderReversalService orderReversalService;
    private final NoticeService noticeService;

    public OrderCancellationService(JdbcTemplate jdbc, OrderReversalService orderReversalService,
                                    NoticeService noticeService) {
        this.jdbc = jdbc;
        this.orderReversalService = orderReversalService;
        this.noticeService = noticeService;
    }

    public boolean cancel(Long orderId) {
        return cancel(orderId, "用户取消订单");
    }

    @Transactional
    public boolean cancel(Long orderId, String reason) {
        int updated = jdbc.update("UPDATE s2b2c_order SET status = 'CANCELLED', update_time = NOW() "
                + "WHERE id = ? AND status = 'PENDING_PAY'", orderId);
        if (updated == 0) return false;
        orderReversalService.restoreBenefits(orderId, true);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT order_no AS orderNo, consumer_id AS consumerId, supplier_id AS supplierId, "
                        + "channel_id AS channelId FROM s2b2c_order WHERE id = ?", orderId);
        if (!rows.isEmpty()) {
            Map<String, Object> order = rows.get(0);
            String orderNo = String.valueOf(order.get("orderNo"));
            String text = "订单 " + orderNo + " 已取消（" + reason + "），库存、优惠券与活动预算已回补。";
            if (order.get("consumerId") != null) {
                jdbc.update("INSERT INTO s2b2c_message (id, sender_id, receiver_id, receiver_type, type, "
                                + "title, content, is_read, create_time) VALUES (?,?,?,?,?,?,?,0,NOW())",
                        IdWorker.getId(), null, order.get("consumerId"), "CONSUMER", "ORDER",
                        "订单已取消", text);
            }
            if (order.get("supplierId") != null) {
                noticeService.notify("SUPPLIER", ((Number) order.get("supplierId")).longValue(),
                        "ORDER_CANCELLED", "订单已取消", text, "ORDER", orderId);
            }
            if (order.get("channelId") != null) {
                noticeService.notify("CHANNEL", ((Number) order.get("channelId")).longValue(),
                        "ORDER_CANCELLED", "订单已取消", text, "ORDER", orderId);
            }
        }
        return true;
    }
}
