package com.agri.s2b2c.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * 活动预算原子预占：券、秒杀、拼团共用。
 *
 * <p>budget NULL 表示不限预算；所有扣减都带 `budget_used + amount <= budget` 条件，
 * 并发下只有一笔能成功，避免超发。调用方在事务内使用，后续失败会随事务回滚。</p>
 */
@Service
public class ActivityBudgetService {

    private static final Map<String, String> TABLES = Map.of(
            "COUPON", "s2b2c_coupon",
            "FLASH", "s2b2c_flash_sale",
            "GROUP", "s2b2c_group_buy");

    private final JdbcTemplate jdbc;

    public ActivityBudgetService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean reserve(String type, Long activityId, BigDecimal amount) {
        if (activityId == null || amount == null || amount.signum() <= 0) return true;
        String table = TABLES.get(type == null ? "" : type.trim().toUpperCase());
        if (table == null) {
            throw new IllegalArgumentException("未知活动类型：" + type);
        }
        BigDecimal scaled = amount.setScale(2, RoundingMode.HALF_UP);
        int updated = jdbc.update("UPDATE " + table + " SET budget_used = budget_used + ? "
                        + "WHERE id = ? AND (budget IS NULL OR budget_used + ? <= budget)",
                scaled, activityId, scaled);
        return updated > 0;
    }

    /** 取消/退款时释放已占预算；budget_used 不会减到负数。 */
    public void release(String type, Long activityId, BigDecimal amount) {
        if (activityId == null || amount == null || amount.signum() <= 0) return;
        String table = TABLES.get(type == null ? "" : type.trim().toUpperCase());
        if (table == null) {
            throw new IllegalArgumentException("未知活动类型：" + type);
        }
        jdbc.update("UPDATE " + table + " SET budget_used = GREATEST(budget_used - ?, 0) WHERE id = ?",
                amount.setScale(2, RoundingMode.HALF_UP), activityId);
    }
}
