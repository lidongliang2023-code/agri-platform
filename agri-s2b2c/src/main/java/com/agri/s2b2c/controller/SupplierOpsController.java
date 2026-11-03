package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.OrderShipmentService;
import com.agri.s2b2c.service.SupplierIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 供应商分销运营台：分销总览、订单、渠道网络、供货收入与动销。
 *
 * <p>供应商主责供货与授权；渠道经营、平台审核、区域分润与财务打款分别归
 * 渠道商端 / 平台运营 / 城市合伙人 / 财务系统。供货收入为估算值，最终以交易撮合合同与结算为准。</p>
 */
@RestController
@RequestMapping("/api/supplier")
@OperatorOnly("s2b2c:supplier")
public class SupplierOpsController {

    private static final DateTimeFormatter DATE_LABEL = DateTimeFormatter.ofPattern("MM-dd");

    private final JdbcTemplate jdbc;
    private final SupplierIdentityService supplierIdentityService;
    private final ProductMapper productMapper;
    private final ChannelProductMapper channelProductMapper;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final OrderMapper orderMapper;
    private final OrderShipmentService shipmentService;

    public SupplierOpsController(JdbcTemplate jdbc, SupplierIdentityService supplierIdentityService,
                                 ProductMapper productMapper, ChannelProductMapper channelProductMapper,
                                 ChannelPartnerMapper channelPartnerMapper, OrderMapper orderMapper,
                                 OrderShipmentService shipmentService) {
        this.jdbc = jdbc;
        this.supplierIdentityService = supplierIdentityService;
        this.productMapper = productMapper;
        this.channelProductMapper = channelProductMapper;
        this.channelPartnerMapper = channelPartnerMapper;
        this.orderMapper = orderMapper;
        this.shipmentService = shipmentService;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview(@RequestParam(defaultValue = "30") int days) {
        Supplier mine = supplierIdentityService.requireCurrent();
        int range = Math.min(Math.max(days, 7), 90);
        LocalDate startDay = LocalDate.now().minusDays(range - 1L);
        LocalDateTime start = startDay.atStartOfDay();

        Map<String, Object> totals = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv FROM s2b2c_order "
                        + "WHERE supplier_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ?", mine.getId(), start);
        long orders = ((Number) totals.get("orders")).longValue();
        BigDecimal gmv = decimal(totals.get("gmv"));
        BigDecimal supplyRevenue = estimatedSupplyRevenue(mine.getId(), start, null);

        Map<String, Object> kpi = new HashMap<>();
        kpi.put("orders", orders);
        kpi.put("gmv", gmv);
        kpi.put("avgOrderAmount", orders == 0 ? BigDecimal.ZERO
                : gmv.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP));
        kpi.put("supplyRevenue", supplyRevenue);
        kpi.put("products", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_product WHERE supplier_id = ? AND status = 'APPROVED'", Long.class, mine.getId()));
        kpi.put("pendingProducts", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_product WHERE supplier_id = ? AND status = 'PENDING'", Long.class, mine.getId()));
        kpi.put("pendingShip", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE supplier_id = ? AND status = 'PENDING_SHIP'", Long.class, mine.getId()));
        kpi.put("channels", jdbc.queryForObject(
                "SELECT COUNT(DISTINCT channel_id) FROM s2b2c_channel_product WHERE supplier_id = ? AND status = 'ACTIVE'",
                Long.class, mine.getId()));
        kpi.put("lowStock", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_product WHERE supplier_id = ? AND status = 'APPROVED' AND stock < 10",
                Long.class, mine.getId()));

        Map<String, BigDecimal> amountByDay = new LinkedHashMap<>();
        Map<String, Long> countByDay = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT DATE(create_time) d, IFNULL(SUM(pay_amount),0) amount, COUNT(*) cnt FROM s2b2c_order "
                        + "WHERE supplier_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? "
                        + "GROUP BY DATE(create_time) ORDER BY DATE(create_time)", mine.getId(), start)) {
            String key = String.valueOf(row.get("d"));
            amountByDay.put(key, decimal(row.get("amount")));
            countByDay.put(key, ((Number) row.get("cnt")).longValue());
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 0; i < range; i++) {
            LocalDate day = startDay.plusDays(i);
            Map<String, Object> point = new HashMap<>();
            point.put("date", day.format(DATE_LABEL));
            point.put("amount", amountByDay.getOrDefault(day.toString(), BigDecimal.ZERO));
            point.put("orders", countByDay.getOrDefault(day.toString(), 0L));
            trend.add(point);
        }

        List<Map<String, Object>> topProducts = jdbc.queryForList(
                "SELECT oi.product_id AS productId, oi.name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.supplier_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY oi.product_id, oi.name ORDER BY amount DESC LIMIT 5", mine.getId(), start);
        List<Map<String, Object>> channelRanking = jdbc.queryForList(
                "SELECT o.channel_id AS channelId, IFNULL(c.shop_name,'直购/未知') channelName, "
                        + "COUNT(*) orders, IFNULL(SUM(o.pay_amount),0) gmv "
                        + "FROM s2b2c_order o LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id "
                        + "WHERE o.supplier_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY o.channel_id, c.shop_name ORDER BY gmv DESC LIMIT 10", mine.getId(), start);

        Map<String, Object> result = new HashMap<>();
        result.put("days", range);
        result.put("kpi", kpi);
        result.put("trend", trend);
        result.put("topProducts", topProducts);
        result.put("channelRanking", channelRanking);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/orders")
    public ResponseEntity<Map<String, Object>> orders(@RequestParam(defaultValue = "1") int page,
                                                      @RequestParam(defaultValue = "10") int size,
                                                      @RequestParam(required = false) String status,
                                                      @RequestParam(required = false) String keyword) {
        Supplier mine = supplierIdentityService.requireCurrent();
        StringBuilder where = new StringBuilder(" WHERE o.supplier_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(mine.getId());
        if (status != null && !status.isBlank()) {
            where.append(" AND o.status = ?");
            args.add(status);
        }
        if (keyword != null && !keyword.isBlank()) {
            where.append(" AND o.order_no LIKE ?");
            args.add("%" + keyword.trim() + "%");
        }
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_order o" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((page - 1) * size);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT o.id, o.order_no AS orderNo, o.channel_id AS channelId, c.shop_name AS channelName, "
                        + "o.pay_amount AS payAmount, o.status, o.logistics_no AS logisticsNo, "
                        + "o.logistics_company AS logisticsCompany, o.create_time AS createTime, o.pay_time AS payTime, "
                        + "(SELECT GROUP_CONCAT(CONCAT(oi.name,' ×',oi.quantity) SEPARATOR '、') FROM s2b2c_order_item oi "
                        + "WHERE oi.order_id = o.id) items "
                        + "FROM s2b2c_order o LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id"
                        + where + " ORDER BY o.create_time DESC LIMIT ? OFFSET ?", pageArgs.toArray());
        Map<String, Object> summary = new HashMap<>();
        summary.put("total", total);
        summary.put("pendingShip", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE supplier_id = ? AND status = 'PENDING_SHIP'", Long.class, mine.getId()));
        Map<String, Object> result = new HashMap<>();
        result.put("records", rows);
        result.put("total", total);
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/order/{id}")
    public ResponseEntity<Map<String, Object>> orderDetail(@PathVariable Long id) {
        Supplier mine = supplierIdentityService.requireCurrent();
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        if (order.getSupplierId() == null || !order.getSupplierId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该订单不属于当前供应商");
        }
        Map<String, Object> result = new HashMap<>();
        result.put("order", order);
        result.put("items", jdbc.queryForList(
                "SELECT id, product_id AS productId, name, spec, price, quantity, total_amount AS totalAmount, image "
                        + "FROM s2b2c_order_item WHERE order_id = ?", id));
        if (order.getChannelId() != null) {
            ChannelPartner channel = channelPartnerMapper.selectById(order.getChannelId());
            if (channel != null) {
                result.put("channel", Map.of("id", channel.getId(),
                        "shopName", channel.getShopName() == null ? "" : channel.getShopName(),
                        "grade", channel.getGrade() == null ? "" : channel.getGrade()));
            }
        }
        result.put("afterSales", jdbc.queryForList(
                "SELECT id, type, reason, amount, status, handle_opinion AS handleOpinion, create_time AS createTime "
                        + "FROM s2b2c_after_sale WHERE order_id = ? ORDER BY create_time DESC", id));
        return ResponseEntity.ok(result);
    }

    @PutMapping("/order/{id}/ship")
    public ResponseEntity<Map<String, Object>> ship(@PathVariable Long id,
                                                    @RequestParam String logisticsNo,
                                                    @RequestParam(required = false) String company) {
        Supplier mine = supplierIdentityService.requireCurrent();
        Order order = orderMapper.selectById(id);
        if (order == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "订单不存在"));
        }
        if (order.getSupplierId() == null || !order.getSupplierId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该订单不属于当前供应商");
        }
        return ResponseEntity.ok(shipmentService.propose(id, "SUPPLIER", mine.getId(), logisticsNo, company));
    }

    @GetMapping("/after-sales")
    public ResponseEntity<List<Map<String, Object>>> afterSales(@RequestParam(required = false) String status) {
        Supplier mine = supplierIdentityService.requireCurrent();
        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.order_id AS orderId, a.type, a.reason, a.amount, a.status, "
                        + "a.handle_opinion AS handleOpinion, a.create_time AS createTime, o.order_no AS orderNo, "
                        + "c.shop_name AS channelName FROM s2b2c_after_sale a "
                        + "JOIN s2b2c_order o ON a.order_id = o.id "
                        + "LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id "
                        + "WHERE o.supplier_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(mine.getId());
        if (status != null && !status.isBlank()) {
            sql.append(" AND a.status = ?");
            args.add(status);
        }
        sql.append(" ORDER BY a.create_time DESC");
        return ResponseEntity.ok(jdbc.queryForList(sql.toString(), args.toArray()));
    }

    @GetMapping("/channels")
    public ResponseEntity<List<Map<String, Object>>> channels() {
        Supplier mine = supplierIdentityService.requireCurrent();
        LocalDateTime start30 = LocalDate.now().minusDays(29).atStartOfDay();
        List<ChannelProduct> relations = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getSupplierId, mine.getId()));
        Map<Long, List<ChannelProduct>> byChannel = new LinkedHashMap<>();
        for (ChannelProduct relation : relations) {
            byChannel.computeIfAbsent(relation.getChannelId(), k -> new ArrayList<>()).add(relation);
        }
        Map<Long, Map<String, Object>> metrics = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT channel_id, COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv, MAX(create_time) last_order "
                        + "FROM s2b2c_order WHERE supplier_id = ? AND channel_id IS NOT NULL "
                        + "AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? GROUP BY channel_id", mine.getId(), start30)) {
            metrics.put(((Number) row.get("channel_id")).longValue(), row);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<Long, List<ChannelProduct>> entry : byChannel.entrySet()) {
            ChannelPartner channel = channelPartnerMapper.selectById(entry.getKey());
            if (channel == null) continue;
            long active = entry.getValue().stream().filter(r -> "ACTIVE".equals(r.getStatus())).count();
            long revoked = entry.getValue().size() - active;
            Map<String, Object> metric = metrics.getOrDefault(entry.getKey(), Map.of());
            Map<String, Object> item = new HashMap<>();
            item.put("channelId", channel.getId());
            item.put("shopName", channel.getShopName());
            item.put("grade", channel.getGrade());
            item.put("auditStatus", channel.getAuditStatus());
            item.put("productCount", entry.getValue().size());
            item.put("activeCount", active);
            item.put("revokedCount", revoked);
            item.put("orders30", metric.getOrDefault("orders", 0));
            item.put("gmv30", metric.getOrDefault("gmv", BigDecimal.ZERO));
            item.put("lastOrderTime", metric.get("last_order"));
            result.add(item);
        }
        result.sort((a, b) -> decimal(b.get("gmv30")).compareTo(decimal(a.get("gmv30"))));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/channel/{id}")
    public ResponseEntity<Map<String, Object>> channelDetail(@PathVariable Long id) {
        Supplier mine = supplierIdentityService.requireCurrent();
        ChannelPartner channel = channelPartnerMapper.selectById(id);
        if (channel == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "渠道商不存在");
        }
        List<Map<String, Object>> products = jdbc.queryForList(
                "SELECT cp.id AS relationId, cp.product_id AS productId, p.name, cp.status, "
                        + "cp.retail_price AS retailPrice, cp.shelf_status AS shelfStatus, cp.picked_at AS pickedAt "
                        + "FROM s2b2c_channel_product cp JOIN s2b2c_product p ON cp.product_id = p.id "
                        + "WHERE cp.supplier_id = ? AND cp.channel_id = ? ORDER BY cp.picked_at DESC",
                mine.getId(), id);
        Map<String, Object> metrics = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv FROM s2b2c_order "
                        + "WHERE supplier_id = ? AND channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED')", mine.getId(), id);
        List<Map<String, Object>> recentOrders = jdbc.queryForList(
                "SELECT id, order_no AS orderNo, pay_amount AS payAmount, status, create_time AS createTime "
                        + "FROM s2b2c_order WHERE supplier_id = ? AND channel_id = ? "
                        + "ORDER BY create_time DESC LIMIT 10", mine.getId(), id);
        Map<String, Object> result = new HashMap<>();
        result.put("channel", Map.of("id", channel.getId(),
                "shopName", channel.getShopName() == null ? "" : channel.getShopName(),
                "grade", channel.getGrade() == null ? "" : channel.getGrade(),
                "contactName", channel.getContactName() == null ? "" : channel.getContactName(),
                "contactPhone", channel.getContactPhone() == null ? "" : channel.getContactPhone(),
                "region", String.join(" ", nonNull(channel.getProvince()), nonNull(channel.getCity()), nonNull(channel.getDistrict())),
                "auditStatus", channel.getAuditStatus() == null ? "" : channel.getAuditStatus()));
        result.put("products", products);
        result.put("metrics", metrics);
        result.put("recentOrders", recentOrders);
        return ResponseEntity.ok(result);
    }

    /** 供货收入（按月估算）：按当前供货价 × 数量；最终以交易撮合合同/结算为准。 */
    /** 评价管理：本供应商商品的评价与商家回复。 */
    @GetMapping("/reviews")
    public ResponseEntity<Map<String, Object>> reviews(
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) Boolean replied,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        Supplier mine = supplierIdentityService.requireCurrent();
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 50);
        StringBuilder where = new StringBuilder(" WHERE p.supplier_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(mine.getId());
        if (rating != null) {
            where.append(" AND r.rating = ?");
            args.add(rating);
        }
        if (replied != null) {
            where.append(replied ? " AND r.reply IS NOT NULL AND r.reply <> ''"
                    : " AND (r.reply IS NULL OR r.reply = '')");
        }
        Long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_review r JOIN s2b2c_product p ON p.id = r.product_id" + where,
                Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add((safePage - 1) * safeSize);
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT r.id, r.order_id AS orderId, o.order_no AS orderNo, r.product_id AS productId, "
                        + "p.name AS productName, c.nickname, r.rating, r.content, r.tags, r.images, "
                        + "r.anonymous, r.reply, r.reply_time AS replyTime, r.reply_by AS replyBy, "
                        + "r.create_time AS createTime FROM s2b2c_review r "
                        + "JOIN s2b2c_product p ON p.id = r.product_id "
                        + "LEFT JOIN s2b2c_order o ON o.id = r.order_id "
                        + "LEFT JOIN s2b2c_consumer c ON c.id = r.consumer_id" + where
                        + " ORDER BY r.create_time DESC, r.id DESC LIMIT ? OFFSET ?", pageArgs.toArray());
        for (Map<String, Object> row : records) {
            if (Boolean.TRUE.equals(row.get("anonymous"))) row.put("nickname", null);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("records", records);
        result.put("total", total == null ? 0 : total);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/review/{id}/reply")
    public ResponseEntity<Map<String, Object>> replyReview(@PathVariable Long id, @RequestParam String reply) {
        Supplier mine = supplierIdentityService.requireCurrent();
        if (reply == null || reply.isBlank()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写回复内容"));
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.reply FROM s2b2c_review r JOIN s2b2c_product p ON p.id = r.product_id "
                        + "WHERE r.id = ? AND p.supplier_id = ?", id, mine.getId());
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该评价不属于当前供应商");
        }
        Object existingReply = rows.get(0).get("reply");
        if (existingReply != null && !String.valueOf(existingReply).isBlank()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该评价已回复"));
        }
        jdbc.update("UPDATE s2b2c_review SET reply = ?, reply_time = NOW(), reply_by = 'SUPPLIER' WHERE id = ?",
                reply.trim(), id);
        return ResponseEntity.ok(Map.of("success", true, "message", "回复已提交"));
    }

    @GetMapping("/revenue")
    public ResponseEntity<Map<String, Object>> revenue(@RequestParam(required = false) String month) {
        Supplier mine = supplierIdentityService.requireCurrent();
        YearMonth period;
        try {
            period = month == null || month.isBlank() ? YearMonth.now() : YearMonth.parse(month);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "账期格式应为 YYYY-MM"));
        }
        LocalDateTime start = period.atDay(1).atStartOfDay();
        LocalDateTime end = period.plusMonths(1).atDay(1).atStartOfDay();
        Map<String, Object> totals = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(o.pay_amount),0) gmv FROM s2b2c_order o "
                        + "WHERE o.supplier_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? AND o.create_time < ?",
                mine.getId(), start, end);
        BigDecimal revenue = estimatedSupplyRevenue(mine.getId(), start, end);
        List<Map<String, Object>> byProduct = jdbc.queryForList(
                "SELECT p.id AS productId, p.name, SUM(oi.quantity) qty, "
                        + "SUM(oi.quantity * COALESCE(oi.supply_price, p.price)) revenue FROM s2b2c_order_item oi "
                        + "JOIN s2b2c_order o ON oi.order_id = o.id JOIN s2b2c_product p ON oi.product_id = p.id "
                        + "WHERE o.supplier_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? AND o.create_time < ? "
                        + "GROUP BY p.id, p.name ORDER BY revenue DESC", mine.getId(), start, end);
        List<Map<String, Object>> byChannel = jdbc.queryForList(
                "SELECT o.channel_id AS channelId, IFNULL(c.shop_name,'直购') channelName, COUNT(*) orders, "
                        + "IFNULL(SUM(o.pay_amount),0) gmv FROM s2b2c_order o "
                        + "LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id "
                        + "WHERE o.supplier_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? AND o.create_time < ? "
                        + "GROUP BY o.channel_id, c.shop_name ORDER BY gmv DESC", mine.getId(), start, end);
        Map<String, Object> summary = new HashMap<>();
        summary.put("orders", totals.get("orders"));
        summary.put("gmv", totals.get("gmv"));
        summary.put("supplyRevenue", revenue);
        Map<String, Object> result = new HashMap<>();
        result.put("month", period.toString());
        result.put("summary", summary);
        result.put("byProduct", byProduct);
        result.put("byChannel", byChannel);
        result.put("note", "供货收入按下单时供货价快照估算，不受后续调价影响；最终以交易撮合合同与财务结算为准，本页不含打款。");
        return ResponseEntity.ok(result);
    }

    private BigDecimal estimatedSupplyRevenue(Long supplierId, LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT IFNULL(SUM(oi.quantity * COALESCE(oi.supply_price, p.price)),0) FROM s2b2c_order_item oi "
                + "JOIN s2b2c_order o ON oi.order_id = o.id JOIN s2b2c_product p ON oi.product_id = p.id "
                + "WHERE o.supplier_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ?";
        if (end == null) {
            return decimal(jdbc.queryForObject(sql, BigDecimal.class, supplierId, start));
        }
        return decimal(jdbc.queryForObject(sql + " AND o.create_time < ?", BigDecimal.class, supplierId, start, end));
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    }

    private String nonNull(String value) {
        return value == null ? "" : value;
    }
}
