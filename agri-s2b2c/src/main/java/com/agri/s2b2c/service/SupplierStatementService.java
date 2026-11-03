package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 供应商供货对账单：按已完成订单的下单供货价快照生成，供应商确认/提出差异。
 * 只做对账，不生成打款单，付款仍归交易撮合/财务。
 */
@Service
public class SupplierStatementService {

    private final JdbcTemplate jdbc;

    public SupplierStatementService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Map<String, Object> generate(Long supplierId, LocalDate periodStart, LocalDate periodEnd,
                                        String operator) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> suppliers = jdbc.queryForList(
                "SELECT id, company_name AS companyName, shop_name AS shopName FROM s2b2c_supplier WHERE id = ?",
                supplierId);
        if (suppliers.isEmpty()) {
            result.put("success", false);
            result.put("message", "供应商不存在");
            return result;
        }
        if (periodStart == null || periodEnd == null || periodEnd.isBefore(periodStart)) {
            result.put("success", false);
            result.put("message", "账期起止日期不合法");
            return result;
        }
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id, batch_no AS batchNo, status FROM s2b2c_supplier_statement "
                        + "WHERE supplier_id = ? AND period_start <= ? AND period_end >= ? LIMIT 1",
                supplierId, periodEnd, periodStart);
        if (!existing.isEmpty()) {
            Map<String, Object> row = existing.get(0);
            result.put("success", true);
            result.put("existing", true);
            result.put("id", row.get("id"));
            result.put("batchNo", row.get("batchNo"));
            result.put("message", "该账期已生成对账单（" + row.get("status") + "）");
            return result;
        }
        List<Map<String, Object>> orders = jdbc.queryForList(
                "SELECT o.id, o.order_no AS orderNo, o.update_time AS completedAt FROM s2b2c_order o "
                        + "WHERE o.supplier_id = ? AND o.status = 'COMPLETED' "
                        + "AND DATE(o.update_time) BETWEEN ? AND ? "
                        + "AND NOT EXISTS (SELECT 1 FROM s2b2c_supplier_statement_order so WHERE so.order_id = o.id)",
                supplierId, periodStart, periodEnd);
        if (orders.isEmpty()) {
            result.put("success", false);
            result.put("message", "该账期没有可对账的已完成订单");
            return result;
        }
        List<Map<String, Object>> details = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> order : orders) {
            Object orderId = order.get("id");
            BigDecimal amount = jdbc.queryForObject(
                    "SELECT IFNULL(SUM(oi.quantity * COALESCE(oi.supply_price, p.price)),0) "
                            + "FROM s2b2c_order_item oi LEFT JOIN s2b2c_product p ON p.id = oi.product_id "
                            + "WHERE oi.order_id = ?", BigDecimal.class, orderId);
            if (amount == null) amount = BigDecimal.ZERO;
            total = total.add(amount);
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("orderId", orderId);
            detail.put("orderNo", order.get("orderNo"));
            detail.put("supplyAmount", amount);
            detail.put("completedAt", order.get("completedAt"));
            details.add(detail);
        }
        Long id = IdWorker.getId();
        String batchNo = "SS" + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(LocalDateTime.now())
                + "-" + supplierId;
        jdbc.update("INSERT INTO s2b2c_supplier_statement (id, batch_no, supplier_id, period_start, period_end, "
                        + "order_count, amount, status, created_by) VALUES (?,?,?,?,?,?,?, 'OPEN', ?)",
                id, batchNo, supplierId, periodStart, periodEnd, orders.size(), total, operator);
        for (Map<String, Object> detail : details) {
            jdbc.update("INSERT INTO s2b2c_supplier_statement_order (id, statement_id, order_id, order_no, "
                            + "supply_amount, completed_at) VALUES (?,?,?,?,?,?)",
                    IdWorker.getId(), id, detail.get("orderId"), detail.get("orderNo"),
                    detail.get("supplyAmount"), detail.get("completedAt"));
        }
        result.put("success", true);
        result.put("existing", false);
        result.put("id", id);
        result.put("batchNo", batchNo);
        result.put("orderCount", orders.size());
        result.put("amount", total);
        result.put("message", "对账单已生成");
        return result;
    }

    public List<Map<String, Object>> list(Long supplierId, String status) {
        StringBuilder sql = new StringBuilder(
                "SELECT st.id, st.batch_no AS batchNo, st.supplier_id AS supplierId, s.company_name AS supplierName, "
                        + "s.shop_name AS shopName, st.period_start AS periodStart, st.period_end AS periodEnd, "
                        + "st.order_count AS orderCount, st.amount, st.status, st.supplier_remark AS supplierRemark, "
                        + "st.confirmed_at AS confirmedAt, st.created_by AS createdBy, st.create_time AS createTime "
                        + "FROM s2b2c_supplier_statement st LEFT JOIN s2b2c_supplier s ON s.id = st.supplier_id "
                        + "WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (supplierId != null) {
            sql.append(" AND st.supplier_id = ?");
            args.add(supplierId);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND st.status = ?");
            args.add(status);
        }
        sql.append(" ORDER BY st.period_end DESC, st.create_time DESC");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    public Map<String, Object> detail(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT st.id, st.batch_no AS batchNo, st.supplier_id AS supplierId, s.company_name AS supplierName, "
                        + "s.shop_name AS shopName, st.period_start AS periodStart, st.period_end AS periodEnd, "
                        + "st.order_count AS orderCount, st.amount, st.status, st.supplier_remark AS supplierRemark, "
                        + "st.confirmed_at AS confirmedAt, st.created_by AS createdBy, st.create_time AS createTime "
                        + "FROM s2b2c_supplier_statement st LEFT JOIN s2b2c_supplier s ON s.id = st.supplier_id "
                        + "WHERE st.id = ?", id);
        if (rows.isEmpty()) return null;
        Map<String, Object> result = new LinkedHashMap<>(rows.get(0));
        result.put("orders", jdbc.queryForList(
                "SELECT order_id AS orderId, order_no AS orderNo, supply_amount AS supplyAmount, "
                        + "completed_at AS completedAt FROM s2b2c_supplier_statement_order "
                        + "WHERE statement_id = ? ORDER BY completed_at, order_id", id));
        return result;
    }

    @Transactional
    public boolean confirm(Long id, Long supplierId, String remark) {
        return jdbc.update("UPDATE s2b2c_supplier_statement SET status = 'CONFIRMED', "
                        + "supplier_remark = ?, confirmed_at = NOW() "
                        + "WHERE id = ? AND supplier_id = ? AND status = 'OPEN'",
                remark, id, supplierId) > 0;
    }

    @Transactional
    public boolean dispute(Long id, Long supplierId, String remark) {
        return jdbc.update("UPDATE s2b2c_supplier_statement SET status = 'DISPUTED', supplier_remark = ? "
                        + "WHERE id = ? AND supplier_id = ? AND status = 'OPEN'",
                remark, id, supplierId) > 0;
    }
}