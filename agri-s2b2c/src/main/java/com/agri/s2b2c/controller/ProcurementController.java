package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.ChannelIdentityService;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 总部集采：平台发起批次，渠道报名数量；只登记需求与到货状态。
 *
 * <p>边界：不生成采购合同、不代收货款、不写库存；供应商合同与付款归交易撮合/财务，
 * 到货入库由仓储/交易撮合完成。S2B2C 只做集采需求汇总与状态跟踪。</p>
 */
@RestController
public class ProcurementController {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;
    private final ProductMapper productMapper;
    private final ChannelIdentityService channelIdentityService;

    public ProcurementController(JdbcTemplate jdbc, ProductMapper productMapper,
                                 ChannelIdentityService channelIdentityService) {
        this.jdbc = jdbc;
        this.productMapper = productMapper;
        this.channelIdentityService = channelIdentityService;
    }

    /* ---------------- 平台运营端 ---------------- */

    @GetMapping("/api/platform/group-purchases")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<List<Map<String, Object>>> platformList(@RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder(
                "SELECT gp.*, p.name AS productName, p.price AS productPrice, p.stock AS productStock, "
                        + "s.company_name AS supplierName FROM s2b2c_group_purchase gp "
                        + "LEFT JOIN s2b2c_product p ON gp.product_id = p.id "
                        + "LEFT JOIN s2b2c_supplier s ON gp.supplier_id = s.id WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            sql.append(" AND gp.status = ?");
            args.add(status.toUpperCase());
        }
        sql.append(" ORDER BY gp.create_time DESC");
        List<Map<String, Object>> batches = jdbc.queryForList(sql.toString(), args.toArray());
        enrichBatches(batches);
        return ResponseEntity.ok(batches);
    }

    @PostMapping("/api/platform/group-purchases")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        Long productId = longObject(body.get("productId"));
        if (productId == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请选择商品"));
        }
        Product product = productMapper.selectById(productId);
        if (product == null || !"APPROVED".equals(product.getStatus())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不存在或未审核通过"));
        }
        BigDecimal price = decimal(body.get("purchasePrice"), BigDecimal.ZERO);
        int minQuantity = integer(body.get("minQuantity"), 0);
        int targetQuantity = integer(body.get("targetQuantity"), 0);
        LocalDateTime start;
        LocalDateTime end;
        try {
            start = parseDateTime(text(body.get("startTime")));
            end = parseDateTime(text(body.get("endTime")));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "时间格式应为 YYYY-MM-DD HH:mm:ss"));
        }
        if (price.signum() <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "集采价必须大于 0"));
        }
        if (minQuantity < 0 || targetQuantity < 0 || targetQuantity < minQuantity) {
            return ResponseEntity.ok(Map.of("success", false, "message", "目标量不能小于起订量"));
        }
        if (end.isBefore(start) || end.isBefore(LocalDateTime.now())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "截止时间需晚于开始时间且未过期"));
        }
        String title = text(body.get("title"));
        if (title.isEmpty()) {
            title = product.getName() + " 集采";
        }
        String status = start.isAfter(LocalDateTime.now()) ? "UPCOMING" : "OPEN";
        Long id = IdWorker.getId();
        jdbc.update("INSERT INTO s2b2c_group_purchase (id, product_id, supplier_id, title, purchase_price, "
                        + "min_quantity, target_quantity, start_time, end_time, warehouse, remark, status, "
                        + "created_by, create_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, '平台运营', NOW())",
                id, productId, product.getSupplierId(), title, price, minQuantity, targetQuantity,
                start, end, text(body.get("warehouse")), text(body.get("remark")), status);
        return ResponseEntity.ok(Map.of("success", true, "message", "集采批次已创建", "id", String.valueOf(id)));
    }

    @GetMapping("/api/platform/group-purchases/{id}")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<Map<String, Object>> platformDetail(@PathVariable Long id) {
        Map<String, Object> batch = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT gp.*, p.name AS productName, p.price AS productPrice, p.stock AS productStock, "
                        + "s.company_name AS supplierName FROM s2b2c_group_purchase gp "
                        + "LEFT JOIN s2b2c_product p ON gp.product_id = p.id "
                        + "LEFT JOIN s2b2c_supplier s ON gp.supplier_id = s.id WHERE gp.id = ?", id)) {
            batch = row;
        }
        if (batch == null) {
            return ResponseEntity.status(404).body(Map.of("message", "集采批次不存在"));
        }
        List<Map<String, Object>> commitments = jdbc.queryForList(
                "SELECT gpo.id, gpo.channel_id AS channelId, c.shop_name AS channelName, gpo.quantity, "
                        + "gpo.amount, gpo.status, gpo.remark, gpo.create_time AS createTime "
                        + "FROM s2b2c_group_purchase_order gpo "
                        + "LEFT JOIN s2b2c_channel_partner c ON gpo.channel_id = c.id "
                        + "WHERE gpo.batch_id = ? ORDER BY gpo.create_time ASC", id);
        Map<String, Object> result = new HashMap<>();
        result.put("batch", batch);
        result.put("commitments", commitments);
        result.put("stats", stats(commitments));
        return ResponseEntity.ok(result);
    }

    @PutMapping("/api/platform/group-purchases/{id}/status")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable Long id,
                                                            @RequestParam String status) {
        String next = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("OPEN", "CLOSED", "FULFILLED", "CANCELLED").contains(next)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 OPEN / CLOSED / FULFILLED / CANCELLED"));
        }
        Map<String, Object> batch = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, status, end_time AS endTime FROM s2b2c_group_purchase WHERE id = ?", id)) {
            batch = row;
        }
        if (batch == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "集采批次不存在"));
        }
        String current = String.valueOf(batch.get("status"));
        boolean legal = switch (current) {
            case "UPCOMING", "OPEN" -> List.of("OPEN", "CLOSED", "CANCELLED").contains(next);
            case "CLOSED" -> List.of("FULFILLED", "CANCELLED", "OPEN").contains(next);
            default -> false;
        };
        if (!legal) {
            return ResponseEntity.ok(Map.of("success", false, "message", "当前状态 " + current + " 不能变更为 " + next));
        }
        if ("OPEN".equals(next)) {
            LocalDateTime end = toDateTime(batch.get("endTime"));
            if (end.isBefore(LocalDateTime.now())) {
                return ResponseEntity.ok(Map.of("success", false, "message", "批次已过截止时间，不能重新开放"));
            }
        }
        jdbc.update("UPDATE s2b2c_group_purchase SET status = ?, update_time = NOW() WHERE id = ?", next, id);
        switch (next) {
            case "CLOSED" -> jdbc.update("UPDATE s2b2c_group_purchase_order SET status = 'CONFIRMED', update_time = NOW() "
                    + "WHERE batch_id = ? AND status = 'RESERVED'", id);
            case "CANCELLED" -> jdbc.update("UPDATE s2b2c_group_purchase_order SET status = 'CANCELLED', update_time = NOW() "
                    + "WHERE batch_id = ? AND status IN ('RESERVED','CONFIRMED')", id);
            case "FULFILLED" -> jdbc.update("UPDATE s2b2c_group_purchase_order SET status = 'FULFILLED', update_time = NOW() "
                    + "WHERE batch_id = ? AND status = 'CONFIRMED'", id);
            case "OPEN" -> jdbc.update("UPDATE s2b2c_group_purchase_order SET status = 'RESERVED', update_time = NOW() "
                    + "WHERE batch_id = ? AND status = 'CONFIRMED'", id);
            default -> { }
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "批次状态已更新为 " + next));
    }

    /* ---------------- 渠道商端 ---------------- */

    @GetMapping("/api/channel/group-purchases")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelList() {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        List<Map<String, Object>> batches = jdbc.queryForList(
                "SELECT gp.*, p.name AS productName, s.company_name AS supplierName "
                        + "FROM s2b2c_group_purchase gp LEFT JOIN s2b2c_product p ON gp.product_id = p.id "
                        + "LEFT JOIN s2b2c_supplier s ON gp.supplier_id = s.id "
                        + "WHERE gp.status IN ('OPEN','UPCOMING') ORDER BY gp.start_time ASC");
        Map<Long, Map<String, Object>> mineByBatch = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, batch_id AS batchId, quantity, amount, status, remark, create_time AS createTime "
                        + "FROM s2b2c_group_purchase_order WHERE channel_id = ?", mine.getId())) {
            mineByBatch.put(((Number) row.get("batchId")).longValue(), row);
        }
        for (Map<String, Object> batch : batches) {
            Long batchId = ((Number) batch.get("id")).longValue();
            batch.put("myCommitment", mineByBatch.get(batchId));
            batch.put("stats", stats(jdbc.queryForList(
                    "SELECT quantity, amount, status FROM s2b2c_group_purchase_order "
                            + "WHERE batch_id = ? AND status <> 'CANCELLED'", batchId)));
        }
        List<Map<String, Object>> myHistory = jdbc.queryForList(
                "SELECT gpo.id, gpo.batch_id AS batchId, gp.title, p.name AS productName, gpo.quantity, "
                        + "gpo.amount, gpo.status, gpo.create_time AS createTime "
                        + "FROM s2b2c_group_purchase_order gpo "
                        + "JOIN s2b2c_group_purchase gp ON gpo.batch_id = gp.id "
                        + "LEFT JOIN s2b2c_product p ON gp.product_id = p.id "
                        + "WHERE gpo.channel_id = ? ORDER BY gpo.create_time DESC", mine.getId());
        Map<String, Object> result = new HashMap<>();
        result.put("batches", batches);
        result.put("history", myHistory);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/channel/group-purchases/{id}/join")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> join(@PathVariable Long id,
                                                    @RequestBody Map<String, Object> body) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        int quantity = integer(body.get("quantity"), 0);
        if (quantity <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "报名数量必须大于 0"));
        }
        Map<String, Object> batch = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, status, purchase_price AS purchasePrice, start_time AS startTime, end_time AS endTime "
                        + "FROM s2b2c_group_purchase WHERE id = ?", id)) {
            batch = row;
        }
        if (batch == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "集采批次不存在"));
        }
        if (!"OPEN".equals(String.valueOf(batch.get("status")))) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该批次未开放报名（" + batch.get("status") + "）"));
        }
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(toDateTime(batch.get("startTime"))) || now.isAfter(toDateTime(batch.get("endTime")))) {
            return ResponseEntity.ok(Map.of("success", false, "message", "不在报名时间窗内"));
        }
        BigDecimal amount = decimal(batch.get("purchasePrice"), BigDecimal.ZERO)
                .multiply(BigDecimal.valueOf(quantity));
        Map<String, Object> existing = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, status FROM s2b2c_group_purchase_order WHERE batch_id = ? AND channel_id = ?",
                id, mine.getId())) {
            existing = row;
        }
        String remark = text(body.get("remark"));
        if (existing == null) {
            jdbc.update("INSERT INTO s2b2c_group_purchase_order (id, batch_id, channel_id, quantity, amount, "
                            + "status, remark, create_time) VALUES (?,?,?,?,?, 'RESERVED', ?, NOW())",
                    IdWorker.getId(), id, mine.getId(), quantity, amount, remark);
        } else {
            jdbc.update("UPDATE s2b2c_group_purchase_order SET quantity = ?, amount = ?, status = 'RESERVED', "
                            + "remark = ?, update_time = NOW() WHERE id = ?",
                    quantity, amount, remark, existing.get("id"));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "已报名 " + quantity + " 件，金额 ¥" + amount,
                "amount", amount));
    }

    @PutMapping("/api/channel/group-purchases/{id}/cancel")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> cancel(@PathVariable Long id) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        Map<String, Object> batch = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, status, end_time AS endTime FROM s2b2c_group_purchase WHERE id = ?", id)) {
            batch = row;
        }
        if (batch == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "集采批次不存在"));
        }
        if (!"OPEN".equals(String.valueOf(batch.get("status")))
                || LocalDateTime.now().isAfter(toDateTime(batch.get("endTime")))) {
            return ResponseEntity.ok(Map.of("success", false, "message", "批次已截止，不能取消报名"));
        }
        int updated = jdbc.update("UPDATE s2b2c_group_purchase_order SET status = 'CANCELLED', update_time = NOW() "
                + "WHERE batch_id = ? AND channel_id = ? AND status = 'RESERVED'", id, mine.getId());
        return ResponseEntity.ok(Map.of("success", updated > 0,
                "message", updated > 0 ? "已取消报名" : "没有可取消的报名"));
    }

    /* ---------------- 内部工具 ---------------- */

    private void enrichBatches(List<Map<String, Object>> batches) {
        for (Map<String, Object> batch : batches) {
            Long id = ((Number) batch.get("id")).longValue();
            List<Map<String, Object>> commitments = jdbc.queryForList(
                    "SELECT quantity, amount, status FROM s2b2c_group_purchase_order "
                            + "WHERE batch_id = ? AND status <> 'CANCELLED'", id);
            batch.put("stats", stats(commitments));
            Object end = batch.get("end_time");
            batch.put("expired", end != null && toDateTime(end).isBefore(LocalDateTime.now()));
        }
    }

    private Map<String, Object> stats(List<Map<String, Object>> commitments) {
        long channels = commitments.size();
        long quantity = 0;
        BigDecimal amount = BigDecimal.ZERO;
        for (Map<String, Object> row : commitments) {
            quantity += row.get("quantity") == null ? 0 : ((Number) row.get("quantity")).longValue();
            amount = amount.add(decimal(row.get("amount"), BigDecimal.ZERO));
        }
        Map<String, Object> stats = new HashMap<>();
        stats.put("channels", channels);
        stats.put("quantity", quantity);
        stats.put("amount", amount);
        return stats;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private BigDecimal decimal(Object value, BigDecimal defaultValue) {
        if (value == null || String.valueOf(value).isBlank()) {
            return defaultValue;
        }
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (RuntimeException e) {
            return defaultValue;
        }
    }

    private int integer(Object value, int defaultValue) {
        if (value == null || String.valueOf(value).isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (RuntimeException e) {
            return defaultValue;
        }
    }

    private Long longObject(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (RuntimeException e) {
            return null;
        }
    }

    private LocalDateTime parseDateTime(String value) {
        String normalized = value.replace('T', ' ');
        if (normalized.length() == 16) {
            normalized = normalized + ":00";
        }
        return LocalDateTime.parse(normalized, TIME_FORMAT);
    }

    private LocalDateTime toDateTime(Object value) {
        if (value instanceof LocalDateTime local) {
            return local;
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        return LocalDateTime.parse(String.valueOf(value).replace(' ', 'T'));
    }
}
