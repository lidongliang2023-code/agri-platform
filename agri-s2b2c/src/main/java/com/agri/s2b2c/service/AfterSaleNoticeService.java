package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/** 售后事件通知：消费者站内信 + 供应商/渠道站内通知。 */
@Service
public class AfterSaleNoticeService {

    private final JdbcTemplate jdbc;
    private final NoticeService noticeService;

    public AfterSaleNoticeService(JdbcTemplate jdbc, NoticeService noticeService) {
        this.jdbc = jdbc;
        this.noticeService = noticeService;
    }

    public void applied(Long afterSaleId) {
        Map<String, Object> info = load(afterSaleId);
        if (info == null) return;
        consumerMessage(info, "售后申请已提交",
                "售后单 " + afterSaleId + " 已提交，订单 " + info.get("orderNo") + "，等待商家处理。");
        notifyMerchant(info, "AFTER_SALE_APPLIED", "售后申请待处理",
                "订单 " + info.get("orderNo") + " 有新的售后退款/退货申请，请及时处理。");
    }

    public void returnShipped(Long afterSaleId) {
        Map<String, Object> info = load(afterSaleId);
        if (info == null) return;
        notifyMerchant(info, "RETURN_SHIPPED", "买家已寄回退货",
                "订单 " + info.get("orderNo") + " 的买家已填写退货物流，请确认收货后退款。");
    }

    public void result(Long afterSaleId, String status) {
        Map<String, Object> info = load(afterSaleId);
        if (info == null) return;
        String normalized = status == null ? "" : status.toUpperCase();
        if ("REJECTED".equals(normalized)) {
            consumerMessage(info, "售后已拒绝",
                    "售后单 " + afterSaleId + " 未通过审核，可联系商家继续协商。");
            notifyMerchant(info, "AFTER_SALE_REJECTED", "售后已拒绝",
                    "订单 " + info.get("orderNo") + " 的售后申请已拒绝。");
            return;
        }
        if ("COMPLETED".equals(normalized)) {
            consumerMessage(info, "退款已完成",
                    "售后单 " + afterSaleId + " 已处理完成，退款金额 ¥" + info.get("amount") + "。");
            notifyMerchant(info, "REFUND_COMPLETED", "退款已完成",
                    "订单 " + info.get("orderNo") + " 的售后退款已完成。");
            return;
        }
        consumerMessage(info, "售后已同意",
                "售后单 " + afterSaleId + " 已同意" + ("RETURNING".equals(normalized) ? "退货，请寄回商品并填写物流。" : "，退款处理中。"));
        notifyMerchant(info, "AFTER_SALE_APPROVED", "售后已同意",
                "订单 " + info.get("orderNo") + " 的售后申请已同意。");
    }

    private Map<String, Object> load(Long afterSaleId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT a.id, a.order_id AS orderId, a.type, a.amount, o.order_no AS orderNo, "
                        + "o.consumer_id AS consumerId, o.supplier_id AS supplierId, o.channel_id AS channelId "
                        + "FROM s2b2c_after_sale a JOIN s2b2c_order o ON o.id = a.order_id WHERE a.id = ?",
                afterSaleId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void consumerMessage(Map<String, Object> info, String title, String content) {
        Object consumerId = info.get("consumerId");
        if (consumerId == null) return;
        jdbc.update("INSERT INTO s2b2c_message (id, sender_id, receiver_id, receiver_type, type, title, content, "
                        + "is_read, create_time) VALUES (?,?,?,?,?,?,?,0,NOW())",
                IdWorker.getId(), null, consumerId, "CONSUMER", "AFTER_SALE", title, content);
    }

    private void notifyMerchant(Map<String, Object> info, String type, String title, String content) {
        Long orderId = ((Number) info.get("orderId")).longValue();
        if (info.get("supplierId") != null) {
            noticeService.notify("SUPPLIER", ((Number) info.get("supplierId")).longValue(),
                    type, title, content, "ORDER", orderId);
        }
        if (info.get("channelId") != null) {
            noticeService.notify("CHANNEL", ((Number) info.get("channelId")).longValue(),
                    type, title, content, "ORDER", orderId);
        }
    }
}