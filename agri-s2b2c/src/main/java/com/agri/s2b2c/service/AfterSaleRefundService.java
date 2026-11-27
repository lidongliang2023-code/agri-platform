package com.agri.s2b2c.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 售后审核：仅退款直接退款；退货退款先同意退货，买家回寄后商家确认收货再退款。
 *
 * <p>全额退款（金额 ≥ 实付 − 0.01）：恢复库存、释放券/秒杀/拼团预算、删除待结算佣金，订单置 REFUNDED；
 * 部分退款只记录售后结果，不动库存与活动成本。退款为系统内状态流转，未对接支付网关。</p>
 */
@Service
public class AfterSaleRefundService {

    private final JdbcTemplate jdbc;
    private final OrderReversalService orderReversalService;
    private final AfterSaleNoticeService afterSaleNoticeService;

    public AfterSaleRefundService(JdbcTemplate jdbc, OrderReversalService orderReversalService,
                                  AfterSaleNoticeService afterSaleNoticeService) {
        this.jdbc = jdbc;
        this.orderReversalService = orderReversalService;
        this.afterSaleNoticeService = afterSaleNoticeService;
    }

    public record Result(boolean success, String message, boolean fullRefund) {
    }

    @Transactional
    public Result approve(Long afterSaleId, String opinion) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT order_id AS orderId, amount, type, status FROM s2b2c_after_sale WHERE id = ? FOR UPDATE", afterSaleId);
        if (rows.isEmpty()) return new Result(false, "售后单不存在", false);
        Map<String, Object> afterSale = rows.get(0);
        if (!"PENDING".equalsIgnoreCase(String.valueOf(afterSale.get("status")))) {
            return new Result(false, "该售后单已处理（" + afterSale.get("status") + "）", false);
        }
        Long orderId = ((Number) afterSale.get("orderId")).longValue();
        String validationError = validateRefund(afterSale);
        if (validationError != null) return new Result(false, validationError, false);
        if ("RETURN".equalsIgnoreCase(String.valueOf(afterSale.get("type")))) {
            int updated = jdbc.update("UPDATE s2b2c_after_sale SET status = 'RETURNING', handle_opinion = ?, "
                    + "handle_time = NOW() WHERE id = ? AND status = 'PENDING'", opinion, afterSaleId);
            if (updated == 0) return new Result(false, "该售后单已处理", false);
            afterSaleNoticeService.result(afterSaleId, "RETURNING");
            return new Result(true, "已同意退货，请等待买家寄回并确认收货后再退款", false);
        }
        int updated = jdbc.update("UPDATE s2b2c_after_sale SET status = 'APPROVED', handle_opinion = ?, "
                + "handle_time = NOW() WHERE id = ? AND status = 'PENDING'", opinion, afterSaleId);
        if (updated == 0) return new Result(false, "该售后单已处理", false);
        boolean fullRefund = refundOrder(orderId, decimal(afterSale.get("amount")));
        afterSaleNoticeService.result(afterSaleId, "COMPLETED");
        return new Result(true, fullRefund
                ? "已同意售后并完成全额退款（系统内状态），库存与活动成本已回补"
                : "已同意部分退款（系统内状态），库存与活动成本不回补", fullRefund);
    }

    /** 买家填写退货物流。 */
    @Transactional
    public boolean submitReturn(Long afterSaleId, Long consumerId, String company, String logisticsNo) {
        if (company == null || company.isBlank() || logisticsNo == null || logisticsNo.isBlank()) return false;
        boolean success = jdbc.update("UPDATE s2b2c_after_sale SET return_company = ?, return_logistics_no = ?, "
                        + "return_shipped_at = NOW() WHERE id = ? AND consumer_id = ? AND type = 'RETURN' "
                        + "AND status = 'RETURNING' AND return_shipped_at IS NULL",
                company.trim(), logisticsNo.trim(), afterSaleId, consumerId) > 0;
        if (success) afterSaleNoticeService.returnShipped(afterSaleId);
        return success;
    }

    /** 商家确认收到退货并完成退款。 */
    @Transactional
    public Result confirmReturn(Long afterSaleId, String opinion) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT order_id AS orderId, amount, type, status, return_shipped_at AS returnShippedAt "
                        + "FROM s2b2c_after_sale WHERE id = ? FOR UPDATE", afterSaleId);
        if (rows.isEmpty()) return new Result(false, "售后单不存在", false);
        Map<String, Object> afterSale = rows.get(0);
        if (!"RETURN".equalsIgnoreCase(String.valueOf(afterSale.get("type")))) {
            return new Result(false, "该售后单不是退货退款", false);
        }
        if (!"RETURNING".equalsIgnoreCase(String.valueOf(afterSale.get("status")))) {
            return new Result(false, "当前状态不能确认收货（" + afterSale.get("status") + "）", false);
        }
        if (afterSale.get("returnShippedAt") == null) {
            return new Result(false, "买家尚未填写退货物流，不能确认收货", false);
        }
        String validationError = validateRefund(afterSale);
        if (validationError != null) return new Result(false, validationError, false);
        int updated = jdbc.update("UPDATE s2b2c_after_sale SET status = 'COMPLETED', handle_opinion = ?, "
                        + "handle_time = NOW(), return_received_at = NOW() "
                        + "WHERE id = ? AND status = 'RETURNING' AND return_shipped_at IS NOT NULL",
                opinion, afterSaleId);
        if (updated == 0) return new Result(false, "该售后单已处理", false);
        Long orderId = ((Number) afterSale.get("orderId")).longValue();
        boolean fullRefund = refundOrder(orderId, decimal(afterSale.get("amount")));
        afterSaleNoticeService.result(afterSaleId, "COMPLETED");
        return new Result(true, fullRefund
                ? "已确认收到退货并完成全额退款，库存与活动成本已回补"
                : "已确认收到退货并完成部分退款，库存与活动成本不回补", fullRefund);
    }

    @Transactional
    public Result reject(Long afterSaleId, String opinion) {
        if (opinion == null || opinion.isBlank()) return new Result(false, "请填写拒绝原因", false);
        int updated = jdbc.update("UPDATE s2b2c_after_sale SET status = 'REJECTED', handle_opinion = ?, "
                + "handle_time = NOW() WHERE id = ? AND status = 'PENDING'", opinion, afterSaleId);
        if (updated > 0) {
            afterSaleNoticeService.result(afterSaleId, "REJECTED");
            return new Result(true, "已拒绝售后申请", false);
        }
        return new Result(false, "售后单不存在或已处理", false);
    }

    /** 在同一事务内锁定订单，审核与收货均先验证，失败时不修改售后状态或发出通知。 */
    private String validateRefund(Map<String, Object> afterSale) {
        String type = String.valueOf(afterSale.get("type"));
        if (!List.of("REFUND", "RETURN").contains(type)) return "售后类型无效";
        List<Map<String, Object>> orders = jdbc.queryForList(
                "SELECT status, pay_amount AS payAmount FROM s2b2c_order WHERE id = ? FOR UPDATE",
                afterSale.get("orderId"));
        if (orders.isEmpty()) return "订单不存在";
        Map<String, Object> order = orders.get(0);
        if (!OrderStatus.AFTER_SALE_ALLOWED.contains(String.valueOf(order.get("status")))) {
            return "当前订单状态不能处理退款";
        }
        BigDecimal amount = decimal(afterSale.get("amount"));
        if (amount.signum() <= 0 || amount.compareTo(decimal(order.get("payAmount"))) > 0) {
            return "售后金额必须大于零且不能超过订单实付金额";
        }
        return null;
    }

    private boolean refundOrder(Long orderId, BigDecimal amount) {
        List<Map<String, Object>> orderRows = jdbc.queryForList(
                "SELECT status, pay_amount AS payAmount FROM s2b2c_order WHERE id = ? FOR UPDATE", orderId);
        if (orderRows.isEmpty()) throw new IllegalStateException("订单不存在，退款已回滚");
        Map<String, Object> order = orderRows.get(0);
        String orderStatus = String.valueOf(order.get("status"));
        if (!OrderStatus.AFTER_SALE_ALLOWED.contains(orderStatus)) {
            throw new IllegalStateException("订单状态已变化，退款已回滚");
        }
        BigDecimal payAmount = decimal(order.get("payAmount"));
        boolean fullRefund = amount.compareTo(payAmount.subtract(new BigDecimal("0.01"))) >= 0;
        if (fullRefund) {
            int updated = jdbc.update("UPDATE s2b2c_order SET status = 'REFUNDED', update_time = NOW() "
                    + "WHERE id = ? AND status = ?", orderId, orderStatus);
            if (updated != 1) throw new IllegalStateException("订单状态已变化，退款已回滚");
            orderReversalService.restoreBenefits(orderId, false);
        }
        return fullRefund;
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    }
}