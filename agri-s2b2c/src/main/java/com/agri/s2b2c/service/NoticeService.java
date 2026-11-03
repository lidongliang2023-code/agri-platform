package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 供应商 / 渠道站内通知：只记录业务事件，不接短信或企微。 */
@Service
public class NoticeService {

    private static final Map<String, String> NOTICE_TITLES = new java.util.LinkedHashMap<>();
    static {
        NOTICE_TITLES.put("ORDER_CREATED", "新订单 / 新渠道订单");
        NOTICE_TITLES.put("SHIP_PROPOSED", "发货信息待确认");
        NOTICE_TITLES.put("SHIP_CONFIRMED", "发货已确认");
        NOTICE_TITLES.put("SHIP_REJECTED", "发货被驳回");
        NOTICE_TITLES.put("SHIP_WITHDRAWN", "发货信息被撤回");
        NOTICE_TITLES.put("DISTRIBUTION_REVOKED", "渠道授权被供应商撤销");
        NOTICE_TITLES.put("PRODUCT_AUTO_OFF_SHELF", "商品超低价自动下架");
        NOTICE_TITLES.put("ORDER_CANCELLED", "订单已取消 / 超时取消");
        NOTICE_TITLES.put("ORDER_COMPLETED", "订单已完成 / 自动确认收货");
        NOTICE_TITLES.put("AFTER_SALE_APPLIED", "售后申请待处理");
        NOTICE_TITLES.put("AFTER_SALE_APPROVED", "售后已同意");
        NOTICE_TITLES.put("AFTER_SALE_REJECTED", "售后已拒绝");
        NOTICE_TITLES.put("RETURN_SHIPPED", "买家已寄回退货");
        NOTICE_TITLES.put("REFUND_COMPLETED", "退款已完成");
        NOTICE_TITLES.put("GRADE_CHANGED", "渠道等级调整");
    }

    private final JdbcTemplate jdbc;

    public NoticeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void notify(String recipientType, Long recipientId, String type, String title, String content,
                       String refType, Long refId) {
        if (recipientId == null) return;
        List<Map<String, Object>> pref = jdbc.queryForList(
                "SELECT enabled FROM s2b2c_notice_preference WHERE recipient_type = ? AND recipient_id = ? AND notice_type = ?",
                recipientType, recipientId, type);
        if (!pref.isEmpty() && ((Number) pref.get(0).get("enabled")).intValue() == 0) {
            return;
        }
        jdbc.update("INSERT INTO s2b2c_notice (id, recipient_type, recipient_id, type, title, content, ref_type, "
                        + "ref_id, read_flag, create_time) VALUES (?,?,?,?,?,?,?,?,0,NOW())",
                IdWorker.getId(), recipientType, recipientId, type, title, content, refType, refId);
    }

    public List<Map<String, Object>> preferences(String recipientType, Long recipientId) {
        Map<String, Boolean> enabled = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT notice_type, enabled FROM s2b2c_notice_preference WHERE recipient_type = ? AND recipient_id = ?",
                recipientType, recipientId)) {
            enabled.put(String.valueOf(row.get("notice_type")), ((Number) row.get("enabled")).intValue() == 1);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, String> entry : NOTICE_TITLES.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("noticeType", entry.getKey());
            item.put("title", entry.getValue());
            item.put("enabled", enabled.getOrDefault(entry.getKey(), true));
            result.add(item);
        }
        return result;
    }

    public boolean updatePreference(String recipientType, Long recipientId, String noticeType, boolean enabled) {
        if (!NOTICE_TITLES.containsKey(noticeType)) {
            return false;
        }
        jdbc.update("INSERT INTO s2b2c_notice_preference (id, recipient_type, recipient_id, notice_type, enabled, update_time) "
                        + "VALUES (?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), update_time = NOW()",
                IdWorker.getId(), recipientType, recipientId, noticeType, enabled ? 1 : 0);
        return true;
    }

    public long unreadCount(String recipientType, Long recipientId) {
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_notice WHERE recipient_type = ? AND recipient_id = ? AND read_flag = 0",
                Long.class, recipientType, recipientId);
        return count == null ? 0 : count;
    }

    public Map<String, Object> list(String recipientType, Long recipientId, boolean unreadOnly, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE recipient_type = ? AND recipient_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(recipientType);
        args.add(recipientId);
        if (unreadOnly) {
            where.append(" AND read_flag = 0");
        }
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_notice" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((page - 1) * size);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, type, title, content, ref_type AS refType, ref_id AS refId, read_flag AS readFlag, "
                        + "create_time AS createTime FROM s2b2c_notice" + where
                        + " ORDER BY create_time DESC LIMIT ? OFFSET ?", pageArgs.toArray());
        Map<String, Object> result = new HashMap<>();
        result.put("records", rows);
        result.put("total", total);
        result.put("unread", unreadCount(recipientType, recipientId));
        return result;
    }

    public boolean markRead(String recipientType, Long recipientId, Long noticeId) {
        return jdbc.update("UPDATE s2b2c_notice SET read_flag = 1 WHERE id = ? AND recipient_type = ? AND recipient_id = ?",
                noticeId, recipientType, recipientId) > 0;
    }

    public int markAllRead(String recipientType, Long recipientId) {
        return jdbc.update("UPDATE s2b2c_notice SET read_flag = 1 WHERE recipient_type = ? AND recipient_id = ? AND read_flag = 0",
                recipientType, recipientId);
    }
}
