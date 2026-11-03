package com.agri.s2b2c.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 活动价（当前只做秒杀）。
 *
 * <p>为什么单独一个服务：秒杀价必须同时作用于「商品列表展示」「购物车小计」「下单落单价」
 * 三个位置，任何一处各算各的就会出现「页面 58 元、结算 68 元」。这里只保留一套判定：</p>
 *
 * <ul>
 *   <li>时间窗内（start_time ≤ now ≤ end_time）、状态 ACTIVE/RUNNING、秒杀库存 &gt; 0；</li>
 *   <li>同一商品有多个场次时取最低价那一场；</li>
 *   <li>个人限购在<b>下单</b>时判定，超限不阻断下单，退回原价（避免把用户卡死在结算页）。</li>
 * </ul>
 *
 * <p>拼团价不在此列：拼团要「成团」才有意义，订单必须携带 groupBuyId 与成团状态，
 * 当前下单链路没有该字段，页面如实标注为展示价。</p>
 */
@Service
public class ActivityPriceService {

    private final JdbcTemplate jdbc;

    public ActivityPriceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 一场正在进行的秒杀。 */
    public record Flash(Long id, BigDecimal price, BigDecimal originalPrice, LocalDateTime startTime,
                        LocalDateTime endTime, int remainStock, int perUserLimit) {
    }

    /** 商品当前可用的秒杀；没有则返回 null。 */
    public Flash activeFlash(Long productId) {
        if (productId == null) return null;
        List<Flash> rows = jdbc.query("""
                SELECT id,sale_price,original_price,start_time,end_time,remain_stock,per_user_limit
                FROM s2b2c_flash_sale
                WHERE product_id=? AND status IN ('ACTIVE','RUNNING')
                  AND start_time<=NOW() AND end_time>=NOW() AND remain_stock>0
                  AND (budget IS NULL OR budget_used < budget)
                ORDER BY sale_price ASC,id ASC LIMIT 1
                """, (rs, i) -> new Flash(
                rs.getLong("id"),
                rs.getBigDecimal("sale_price"),
                rs.getBigDecimal("original_price"),
                rs.getTimestamp("start_time").toLocalDateTime(),
                rs.getTimestamp("end_time").toLocalDateTime(),
                rs.getInt("remain_stock"),
                rs.getInt("per_user_limit")), productId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 该消费者在本场秒杀开始后已买过多少件（取消的订单不计）。 */
    public int purchasedQuantity(Long productId, Long consumerId, LocalDateTime since) {
        if (productId == null || consumerId == null || since == null) return 0;
        Integer sum = jdbc.queryForObject("""
                SELECT COALESCE(SUM(oi.quantity),0)
                FROM s2b2c_order_item oi JOIN s2b2c_order o ON o.id=oi.order_id
                WHERE oi.product_id=? AND o.consumer_id=? AND o.create_time>=? AND o.status<>'CANCELLED'
                """, Integer.class, productId, consumerId, since);
        return sum == null ? 0 : sum;
    }

    /**
     * 扣秒杀库存。必须带上 remain_stock 条件做乐观扣减：
     * 并发下两个订单都读到「还剩 1 件」时，只有一条 UPDATE 能成功。
     *
     * @return 是否扣减成功
     */
    public boolean deductStock(Long flashId, int quantity) {
        return jdbc.update("""
                UPDATE s2b2c_flash_sale SET remain_stock=remain_stock-?
                WHERE id=? AND remain_stock>=?
                """, quantity, flashId, quantity) > 0;
    }
}
