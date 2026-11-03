package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 订单权益回补：取消未付款订单、全额退款时共用。
 *
 * <p>恢复商品/秒杀库存、释放券/秒杀/拼团预算、清掉待结算佣金；取消订单时额外把拼团成员置取消，
 * 已付款退款保持团成员关系（团已正常成团，退款只回补活动成本）。</p>
 *
 * <p>调用方必须先完成订单/售后状态的条件更新，避免同一笔订单重复回补。</p>
 */
@Service
public class OrderReversalService {

    private final JdbcTemplate jdbc;
    private final ActivityBudgetService activityBudgetService;

    public OrderReversalService(JdbcTemplate jdbc, ActivityBudgetService activityBudgetService) {
        this.jdbc = jdbc;
        this.activityBudgetService = activityBudgetService;
    }

    @Transactional
    public void restoreBenefits(Long orderId, boolean releaseGroupMembership) {
        Map<String, Object> order = jdbc.queryForMap(
                "SELECT coupon_user_id AS couponUserId, coupon_discount AS couponDiscount, "
                        + "group_buy_id AS groupBuyId, group_instance_id AS groupInstanceId, "
                        + "group_subsidy AS groupSubsidy FROM s2b2c_order WHERE id = ?", orderId);

        for (Map<String, Object> item : jdbc.queryForList(
                "SELECT product_id AS productId, quantity, flash_sale_id AS flashSaleId, "
                        + "flash_subsidy AS flashSubsidy FROM s2b2c_order_item WHERE order_id = ?", orderId)) {
            int quantity = ((Number) item.get("quantity")).intValue();
            jdbc.update("UPDATE s2b2c_product SET stock = IFNULL(stock,0) + ?, "
                            + "sales = GREATEST(IFNULL(sales,0) - ?, 0), update_time = NOW() WHERE id = ?",
                    quantity, quantity, item.get("productId"));
            if (item.get("flashSaleId") != null) {
                Long flashId = ((Number) item.get("flashSaleId")).longValue();
                jdbc.update("UPDATE s2b2c_flash_sale SET remain_stock = remain_stock + ? WHERE id = ?",
                        quantity, flashId);
                activityBudgetService.release("FLASH", flashId, decimal(item.get("flashSubsidy")));
            }
        }

        if (order.get("couponUserId") != null) {
            Long couponUserId = ((Number) order.get("couponUserId")).longValue();
            List<Long> couponIds = jdbc.queryForList(
                    "SELECT coupon_id FROM s2b2c_coupon_user WHERE id = ?", Long.class, couponUserId);
            if (!couponIds.isEmpty() && couponIds.get(0) != null) {
                activityBudgetService.release("COUPON", couponIds.get(0), decimal(order.get("couponDiscount")));
            }
            Integer active = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM s2b2c_order WHERE coupon_user_id = ? "
                            + "AND status NOT IN ('CANCELLED','REFUNDED')",
                    Integer.class, couponUserId);
            if (active == null || active == 0) {
                jdbc.update("UPDATE s2b2c_coupon_user SET status = 'UNUSED', order_id = NULL, "
                        + "use_time = NULL WHERE id = ?", couponUserId);
            }
        }

        if (order.get("groupBuyId") != null) {
            Long groupBuyId = ((Number) order.get("groupBuyId")).longValue();
            activityBudgetService.release("GROUP", groupBuyId, decimal(order.get("groupSubsidy")));
            if (releaseGroupMembership) {
                jdbc.update("UPDATE s2b2c_group_buy_order SET status = 'CANCELLED' WHERE order_id = ?", orderId);
                if (order.get("groupInstanceId") != null) {
                    Long instanceId = ((Number) order.get("groupInstanceId")).longValue();
                    jdbc.update("UPDATE s2b2c_group_instance SET joined_count = GREATEST(joined_count - 1, 0), "
                            + "update_time = NOW() WHERE id = ?", instanceId);
                    Integer activeMembers = jdbc.queryForObject(
                            "SELECT COUNT(*) FROM s2b2c_group_buy_order "
                                    + "WHERE instance_id = ? AND status <> 'CANCELLED'", Integer.class, instanceId);
                    if (activeMembers == null || activeMembers == 0) {
                        jdbc.update("UPDATE s2b2c_group_instance SET status = 'FAILED', update_time = NOW() "
                                + "WHERE id = ? AND status = 'PENDING'", instanceId);
                    }
                }
            }
        }

        List<Map<String, Object>> commissions = jdbc.queryForList(
                "SELECT id, channel_id AS channelId, amount, rate, status FROM s2b2c_commission WHERE order_id = ?",
                orderId);
        Integer reversed = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_commission WHERE order_id = ? AND amount < 0 AND remark = '退款冲回'",
                Integer.class, orderId);
        boolean alreadyReversed = reversed != null && reversed > 0;
        for (Map<String, Object> commission : commissions) {
            String status = String.valueOf(commission.get("status"));
            if ("PENDING".equalsIgnoreCase(status)) {
                jdbc.update("DELETE FROM s2b2c_commission WHERE id = ?", commission.get("id"));
            } else if ("SETTLED".equalsIgnoreCase(status) && !alreadyReversed) {
                BigDecimal amount = new BigDecimal(String.valueOf(commission.get("amount"))).negate();
                jdbc.update("INSERT INTO s2b2c_commission (id, order_id, channel_id, amount, rate, status, "
                                + "settle_time, remark, create_time) VALUES (?,?,?,?,?, 'SETTLED', NOW(), '退款冲回', NOW())",
                        IdWorker.getId(), orderId, commission.get("channelId"), amount, commission.get("rate"));
                alreadyReversed = true;
            }
        }
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    }
}
