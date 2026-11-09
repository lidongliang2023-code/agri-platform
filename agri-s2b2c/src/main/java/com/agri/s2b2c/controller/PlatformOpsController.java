package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.service.MarketingStatusService;
import com.agri.s2b2c.service.PriceGuardService;
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
 * 平台运营端：运营大盘、订单状态、售后、佣金报表、价盘与活动聚合。
 *
 * <p>运营端只做平台级汇总与审核；商品主数据、类目主数据、区域分润、账号实名分别归
 * 交易撮合 / 主数据 / 城市合伙人 / 用户中心，本控制器不复制对方主数据。</p>
 */
@RestController
@RequestMapping("/api/platform")
@OperatorOnly("s2b2c:read")
public class PlatformOpsController {

    private static final DateTimeFormatter DATE_LABEL = DateTimeFormatter.ofPattern("MM-dd");

    private final JdbcTemplate jdbc;
    private final PriceGuardService priceGuardService;
    private final MarketingStatusService marketingStatusService;

    public PlatformOpsController(JdbcTemplate jdbc, PriceGuardService priceGuardService,
                                 MarketingStatusService marketingStatusService) {
        this.jdbc = jdbc;
        this.priceGuardService = priceGuardService;
        this.marketingStatusService = marketingStatusService;
    }

    /** 运营大盘：KPI、走势、状态/等级分布、待办与热销商品。 */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview(@RequestParam(defaultValue = "7") int days) {
        int range = Math.min(Math.max(days, 7), 90);
        LocalDate startDay = LocalDate.now().minusDays(range - 1L);
        LocalDateTime start = startDay.atStartOfDay();

        Map<String, Object> totals = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv, COUNT(DISTINCT consumer_id) consumers, "
                        + "COUNT(DISTINCT channel_id) active_channels "
                        + "FROM s2b2c_order WHERE status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ?", start);
        BigDecimal gmv = new BigDecimal(String.valueOf(totals.get("gmv")));
        long orders = ((Number) totals.get("orders")).longValue();

        BigDecimal refundAmount = jdbc.queryForObject(
                "SELECT IFNULL(SUM(amount),0) FROM s2b2c_after_sale WHERE status = 'APPROVED' AND create_time >= ?",
                BigDecimal.class, start);
        BigDecimal refundRate = gmv.signum() == 0 ? BigDecimal.ZERO
                : refundAmount.multiply(new BigDecimal("100")).divide(gmv, 2, RoundingMode.HALF_UP);

        Map<String, Object> kpi = new HashMap<>();
        kpi.put("gmv", gmv);
        kpi.put("orders", orders);
        kpi.put("avgOrderAmount", orders == 0 ? BigDecimal.ZERO
                : gmv.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP));
        kpi.put("consumers", totals.get("consumers"));
        kpi.put("activeChannels", totals.get("active_channels"));
        kpi.put("refundRate", refundRate);
        kpi.put("channels", jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_channel_partner WHERE audit_status = 'APPROVED'", Long.class));
        kpi.put("products", jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_product WHERE status = 'APPROVED'", Long.class));
        kpi.put("suppliers", jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_supplier", Long.class));

        Map<String, BigDecimal> amountByDay = new LinkedHashMap<>();
        Map<String, Long> countByDay = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT DATE(create_time) d, IFNULL(SUM(pay_amount),0) amount, COUNT(*) cnt FROM s2b2c_order "
                        + "WHERE status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? GROUP BY DATE(create_time) ORDER BY DATE(create_time)",
                start)) {
            String key = String.valueOf(row.get("d"));
            amountByDay.put(key, new BigDecimal(String.valueOf(row.get("amount"))));
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

        Map<String, Object> byStatus = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT status, COUNT(*) cnt FROM s2b2c_order GROUP BY status")) {
            byStatus.put(String.valueOf(row.get("status")), row.get("cnt"));
        }

        List<Map<String, Object>> gradeDistribution = jdbc.queryForList(
                "SELECT c.grade, COUNT(*) channels, IFNULL(SUM(o.pay_amount),0) gmv "
                        + "FROM s2b2c_channel_partner c LEFT JOIN s2b2c_order o ON o.channel_id = c.id "
                        + "AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY c.grade ORDER BY gmv DESC", start);

        Map<String, Object> todos = new HashMap<>();
        todos.put("channelPending", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_channel_partner WHERE audit_status = 'PENDING'", Long.class));
        todos.put("productPending", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_product WHERE status = 'PENDING'", Long.class));
        todos.put("withdrawalPending", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_commission_withdrawal WHERE status = 'PENDING'", Long.class));
        todos.put("afterSalePending", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_after_sale WHERE status = 'PENDING'", Long.class));

        List<Map<String, Object>> topProducts = jdbc.queryForList(
                "SELECT oi.product_id, oi.name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY oi.product_id, oi.name ORDER BY amount DESC LIMIT 5", start);

        Map<String, Object> result = new HashMap<>();
        result.put("days", range);
        result.put("kpi", kpi);
        result.put("trend", trend);
        result.put("byStatus", byStatus);
        result.put("gradeDistribution", gradeDistribution);
        result.put("todos", todos);
        result.put("topProducts", topProducts);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/order-stats")
    public ResponseEntity<Map<String, Object>> orderStats() {
        Map<String, Object> byStatus = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT status, COUNT(*) cnt FROM s2b2c_order GROUP BY status")) {
            byStatus.put(String.valueOf(row.get("status")), row.get("cnt"));
        }
        Map<String, Object> today = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) amount FROM s2b2c_order "
                        + "WHERE status NOT IN ('CANCELLED','REFUNDED') AND DATE(create_time) = CURDATE()");
        Map<String, Object> result = new HashMap<>();
        result.put("byStatus", byStatus);
        result.put("todayOrders", today.get("orders"));
        result.put("todayAmount", today.get("amount"));
        result.put("pendingShip", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE status = 'PENDING_SHIP'", Long.class));
        result.put("pendingAfterSale", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_after_sale WHERE status = 'PENDING'", Long.class));
        return ResponseEntity.ok(result);
    }

    /** 售后工单列表（平台视角，含渠道与订单号）。 */
    @GetMapping("/after-sales")
    public ResponseEntity<List<Map<String, Object>>> afterSales(@RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.order_id AS orderId, a.consumer_id AS consumerId, a.type, a.reason, a.amount, "
                        + "a.status, a.handle_opinion AS handleOpinion, a.handle_time AS handleTime, "
                        + "a.return_company AS returnCompany, a.return_logistics_no AS returnLogisticsNo, "
                        + "a.return_shipped_at AS returnShippedAt, a.return_received_at AS returnReceivedAt, "
                        + "a.create_time AS createTime, o.order_no AS orderNo, o.channel_id AS channelId, "
                        + "c.shop_name AS channelName "
                        + "FROM s2b2c_after_sale a JOIN s2b2c_order o ON a.order_id = o.id "
                        + "LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            sql.append(" AND a.status = ?");
            args.add(status);
        }
        sql.append(" ORDER BY a.create_time DESC");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        for (Map<String, Object> row : rows) {
            Object orderId = row.get("orderId");
            List<String> names = new ArrayList<>();
            if (orderId != null) {
                names = jdbc.queryForList(
                                "SELECT CONCAT(name, ' ×', quantity) label FROM s2b2c_order_item WHERE order_id = ?",
                                String.class, String.valueOf(orderId))
                        .stream().toList();
            }
            row.put("items", String.join("、", names));
        }
        return ResponseEntity.ok(rows);
    }

    /** 数据报表中心：交易、类目、渠道、营销、履约、财务六类主题汇总。 */
    @GetMapping("/reports")
    public ResponseEntity<Map<String, Object>> reports(@RequestParam(defaultValue = "30") int days) {
        int range = Math.min(Math.max(days, 7), 90);
        LocalDate startDay = LocalDate.now().minusDays(range - 1L);
        LocalDateTime start = startDay.atStartOfDay();

        Map<String, Object> totals = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv, COUNT(DISTINCT consumer_id) consumers "
                        + "FROM s2b2c_order WHERE status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ?", start);
        BigDecimal gmv = new BigDecimal(String.valueOf(totals.get("gmv")));
        long orders = ((Number) totals.get("orders")).longValue();
        BigDecimal refundAmount = jdbc.queryForObject(
                "SELECT IFNULL(SUM(amount),0) FROM s2b2c_after_sale WHERE status = 'APPROVED' AND create_time >= ?",
                BigDecimal.class, start);
        Map<String, Object> summary = new HashMap<>();
        summary.put("gmv", gmv);
        summary.put("orders", orders);
        summary.put("avgOrderAmount", orders == 0 ? BigDecimal.ZERO
                : gmv.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP));
        summary.put("consumers", totals.get("consumers"));
        summary.put("refundRate", gmv.signum() == 0 ? BigDecimal.ZERO
                : refundAmount.multiply(new BigDecimal("100")).divide(gmv, 2, RoundingMode.HALF_UP));

        Map<String, BigDecimal> amountByDay = new LinkedHashMap<>();
        Map<String, Long> countByDay = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT DATE(create_time) d, IFNULL(SUM(pay_amount),0) amount, COUNT(*) cnt FROM s2b2c_order "
                        + "WHERE status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? GROUP BY DATE(create_time) ORDER BY DATE(create_time)",
                start)) {
            String key = String.valueOf(row.get("d"));
            amountByDay.put(key, new BigDecimal(String.valueOf(row.get("amount"))));
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

        List<Map<String, Object>> categoryShare = jdbc.queryForList(
                "SELECT IFNULL(c.name, '未分类') name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "LEFT JOIN s2b2c_product p ON oi.product_id = p.id "
                        + "LEFT JOIN s2b2c_category c ON p.category_id = c.id "
                        + "WHERE o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY c.name ORDER BY amount DESC", start);
        for (Map<String, Object> row : categoryShare) {
            BigDecimal amount = new BigDecimal(String.valueOf(row.get("amount")));
            row.put("share", gmv.signum() == 0 ? BigDecimal.ZERO
                    : amount.multiply(new BigDecimal("100")).divide(gmv, 2, RoundingMode.HALF_UP));
        }

        List<Map<String, Object>> channelRanking = jdbc.queryForList(
                "SELECT o.channel_id AS channelId, IFNULL(c.shop_name, '未知渠道') channelName, "
                        + "COUNT(*) orders, IFNULL(SUM(o.pay_amount),0) gmv "
                        + "FROM s2b2c_order o LEFT JOIN s2b2c_channel_partner c ON o.channel_id = c.id "
                        + "WHERE o.status NOT IN ('CANCELLED','REFUNDED') AND o.channel_id IS NOT NULL AND o.create_time >= ? "
                        + "GROUP BY o.channel_id, c.shop_name ORDER BY gmv DESC LIMIT 10", start);

        List<Map<String, Object>> topProducts = jdbc.queryForList(
                "SELECT oi.product_id AS productId, oi.name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY oi.product_id, oi.name ORDER BY amount DESC LIMIT 5", start);

        Map<String, Object> fulfillment = new HashMap<>();
        fulfillment.put("pendingShip", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE status = 'PENDING_SHIP'", Long.class));
        fulfillment.put("shipped", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE status IN ('SHIPPED','PENDING_RECEIVE')", Long.class));
        fulfillment.put("completed", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE status = 'COMPLETED'", Long.class));
        fulfillment.put("cancelled", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE status = 'CANCELLED'", Long.class));
        fulfillment.put("afterSalePending", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_after_sale WHERE status = 'PENDING'", Long.class));

        Map<String, Object> finance = new HashMap<>();
        Map<String, Object> commission = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END),0) settled, "
                        + "IFNULL(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END),0) pending "
                        + "FROM s2b2c_commission");
        finance.put("commissionSettled", commission.get("settled"));
        finance.put("commissionPending", commission.get("pending"));
        finance.put("withdrawalPaid", jdbc.queryForObject(
                "SELECT IFNULL(SUM(amount),0) FROM s2b2c_commission_withdrawal WHERE status = 'PAID'", BigDecimal.class));
        finance.put("settlementBatches", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_commission_settlement", Long.class));
        finance.put("settlementAmount", jdbc.queryForObject(
                "SELECT IFNULL(SUM(amount),0) FROM s2b2c_commission_settlement", BigDecimal.class));

        Map<String, Object> marketing = new HashMap<>();
        marketing.put("couponActive", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_coupon WHERE status = 'ACTIVE'", Long.class));
        marketing.put("couponReceived", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_coupon_user", Long.class));
        marketing.put("couponUsed", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_coupon_user WHERE status = 'USED'", Long.class));
        marketing.put("flashActive", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_flash_sale WHERE status = 'ACTIVE'", Long.class));
        marketing.put("groupActive", jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_group_buy WHERE status = 'ACTIVE'", Long.class));

        Map<String, Object> result = new HashMap<>();
        result.put("days", range);
        result.put("summary", summary);
        result.put("trend", trend);
        result.put("categoryShare", categoryShare);
        result.put("channelRanking", channelRanking);
        result.put("topProducts", topProducts);
        result.put("fulfillment", fulfillment);
        result.put("finance", finance);
        result.put("marketing", marketing);
        return ResponseEntity.ok(result);
    }

    /**
     * 库存视图（供货侧）：商品库存、7 日动销、可售天数与渠道在售数。
     *
     * <p>云仓/门店分仓库存与安全库存阈值尚未建模，本接口只读商品级库存，
     * 不提供调拨或补货写入。</p>
     */
    @GetMapping("/inventory")
    public ResponseEntity<Map<String, Object>> inventory(@RequestParam(required = false) String keyword) {
        StringBuilder sql = new StringBuilder(
                "SELECT p.id, p.name, p.price, p.stock, p.sales, p.supplier_id AS supplierId, "
                        + "s.company_name AS supplierName, c.name AS categoryName "
                        + "FROM s2b2c_product p LEFT JOIN s2b2c_supplier s ON p.supplier_id = s.id "
                        + "LEFT JOIN s2b2c_category c ON p.category_id = c.id WHERE p.status = 'APPROVED'");
        List<Object> args = new ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND p.name LIKE ?");
            args.add("%" + keyword.trim() + "%");
        }
        sql.append(" ORDER BY p.stock ASC LIMIT 300");
        List<Map<String, Object>> products = jdbc.queryForList(sql.toString(), args.toArray());

        Map<Long, Long> sales7 = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT oi.product_id, SUM(oi.quantity) qty FROM s2b2c_order_item oi "
                        + "JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? GROUP BY oi.product_id",
                LocalDate.now().minusDays(6).atStartOfDay())) {
            sales7.put(((Number) row.get("product_id")).longValue(), ((Number) row.get("qty")).longValue());
        }
        Map<Long, Long> listing = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT product_id, COUNT(*) cnt FROM s2b2c_channel_product "
                        + "WHERE status = 'ACTIVE' AND (shelf_status IS NULL OR shelf_status <> 'OFF') GROUP BY product_id")) {
            listing.put(((Number) row.get("product_id")).longValue(), ((Number) row.get("cnt")).longValue());
        }

        int lowCount = 0;
        int outCount = 0;
        long totalStock = 0;
        BigDecimal stockValue = BigDecimal.ZERO;
        for (Map<String, Object> product : products) {
            Long id = ((Number) product.get("id")).longValue();
            long stock = longValue(product.get("stock"));
            long sold = sales7.getOrDefault(id, 0L);
            BigDecimal price = decimalValue(product.get("price"));
            totalStock += stock;
            stockValue = stockValue.add(price.multiply(BigDecimal.valueOf(stock)));
            BigDecimal days = sold == 0 ? null
                    : BigDecimal.valueOf(stock).multiply(new BigDecimal("7"))
                    .divide(BigDecimal.valueOf(sold), 1, RoundingMode.HALF_UP);
            product.put("sales7", sold);
            product.put("daysOfSupply", days);
            product.put("channelListings", listing.getOrDefault(id, 0L));
            if (stock <= 0) {
                outCount++;
                product.put("stockStatus", "OUT");
            } else if (sold > 0 && days.compareTo(new BigDecimal("7")) < 0) {
                lowCount++;
                product.put("stockStatus", "LOW");
            } else {
                product.put("stockStatus", "NORMAL");
            }
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("skuCount", products.size());
        summary.put("totalStock", totalStock);
        summary.put("stockValue", stockValue);
        summary.put("lowCount", lowCount);
        summary.put("outCount", outCount);
        Map<String, Object> result = new HashMap<>();
        result.put("records", products);
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }

    /** 商家经营绩效列表：按渠道聚合订单、复购、售后与在售商品。 */
    @GetMapping("/channel-performance")
    public ResponseEntity<Map<String, Object>> channelPerformance(@RequestParam(required = false) String keyword,
                                                                  @RequestParam(required = false) String grade,
                                                                  @RequestParam(required = false) String status,
                                                                  @RequestParam(defaultValue = "1") int page,
                                                                  @RequestParam(defaultValue = "10") int size) {
        LocalDateTime start30 = LocalDate.now().minusDays(29).atStartOfDay();
        Map<Long, Map<String, Object>> metrics = aggregateChannelMetrics(start30);
        List<Map<String, Object>> channels = jdbc.queryForList(
                "SELECT id, shop_name AS shopName, company_name AS companyName, contact_name AS contactName, "
                        + "contact_phone AS contactPhone, province, city, grade, audit_status AS auditStatus, "
                        + "create_time AS createTime FROM s2b2c_channel_partner ORDER BY create_time DESC");
        List<Map<String, Object>> records = new ArrayList<>();
        int active30 = 0;
        int sleeping = 0;
        int risk = 0;
        BigDecimal gmv30Total = BigDecimal.ZERO;
        for (Map<String, Object> channel : channels) {
            Long id = ((Number) channel.get("id")).longValue();
            Map<String, Object> metric = metrics.getOrDefault(id, new HashMap<>());
            long orders30 = longValue(metric.get("orders30"));
            BigDecimal gmv30 = decimalValue(metric.get("gmv30"));
            long repeatConsumers = longValue(metric.get("repeatConsumers"));
            long distinctConsumers = longValue(metric.get("distinctConsumers"));
            long afterSaleCount = longValue(metric.get("afterSaleCount"));
            BigDecimal repeatRate = distinctConsumers == 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(repeatConsumers).multiply(new BigDecimal("100"))
                    .divide(BigDecimal.valueOf(distinctConsumers), 2, RoundingMode.HALF_UP);
            BigDecimal afterSaleRate = orders30 == 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(afterSaleCount).multiply(new BigDecimal("100"))
                    .divide(BigDecimal.valueOf(orders30), 2, RoundingMode.HALF_UP);
            String health = orders30 == 0 ? "SLEEPING"
                    : afterSaleRate.compareTo(new BigDecimal("5")) > 0 ? "RISK"
                    : repeatRate.compareTo(new BigDecimal("40")) >= 0 ? "HEALTHY" : "NORMAL";
            if (orders30 > 0) active30++;
            if ("SLEEPING".equals(health)) sleeping++;
            if ("RISK".equals(health)) risk++;
            gmv30Total = gmv30Total.add(gmv30);

            if (keyword != null && !keyword.isBlank()) {
                String kw = keyword.trim();
                String haystack = String.join(" ", nullToEmpty(channel.get("shopName")),
                        nullToEmpty(channel.get("companyName")), nullToEmpty(channel.get("contactName")),
                        nullToEmpty(channel.get("contactPhone")));
                if (!haystack.contains(kw)) continue;
            }
            if (grade != null && !grade.isBlank() && !grade.equals(String.valueOf(channel.get("grade")))) continue;
            if (status != null && !status.isBlank() && !status.equals(String.valueOf(channel.get("auditStatus")))) continue;

            channel.put("gmv30", gmv30);
            channel.put("orders30", orders30);
            channel.put("gmvTotal", decimalValue(metric.get("gmvTotal")));
            channel.put("ordersTotal", longValue(metric.get("ordersTotal")));
            channel.put("repeatRate", repeatRate);
            channel.put("afterSaleRate", afterSaleRate);
            channel.put("productCount", longValue(metric.get("productCount")));
            channel.put("lastOrderTime", metric.get("lastOrderTime"));
            channel.put("health", health);
            records.add(channel);
        }
        records.sort((a, b) -> ((BigDecimal) b.get("gmv30")).compareTo((BigDecimal) a.get("gmv30")));
        int from = Math.min(Math.max((page - 1) * size, 0), records.size());
        int to = Math.min(from + size, records.size());
        Map<String, Object> summary = new HashMap<>();
        summary.put("channels", channels.size());
        summary.put("active30", active30);
        summary.put("sleeping", sleeping);
        summary.put("risk", risk);
        summary.put("gmv30", gmv30Total);
        Map<String, Object> result = new HashMap<>();
        result.put("records", records.subList(from, to));
        result.put("total", records.size());
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }

    /** 商家经营绩效详情：近 30 天走势、热销商品、最近订单、佣金与提现概况。 */
    @GetMapping("/channel/{id}/performance")
    public ResponseEntity<Map<String, Object>> channelPerformanceDetail(@PathVariable Long id) {
        Map<String, Object> channel = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, shop_name AS shopName, company_name AS companyName, contact_name AS contactName, "
                        + "contact_phone AS contactPhone, province, city, district, address, grade, "
                        + "audit_status AS auditStatus, audit_time AS auditTime, create_time AS createTime "
                        + "FROM s2b2c_channel_partner WHERE id = ?", id)) {
            channel = row;
        }
        if (channel == null) {
            return ResponseEntity.status(404).body(Map.of("message", "商家不存在"));
        }
        LocalDateTime start30 = LocalDate.now().minusDays(29).atStartOfDay();
        Map<String, Object> metric = aggregateChannelMetrics(start30).getOrDefault(id, new HashMap<>());

        List<Map<String, Object>> trendRows = jdbc.queryForList(
                "SELECT DATE(create_time) d, IFNULL(SUM(pay_amount),0) amount, COUNT(*) cnt FROM s2b2c_order "
                        + "WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? "
                        + "GROUP BY DATE(create_time) ORDER BY DATE(create_time)", id, start30);
        Map<String, BigDecimal> amountByDay = new LinkedHashMap<>();
        Map<String, Long> countByDay = new LinkedHashMap<>();
        for (Map<String, Object> row : trendRows) {
            String key = String.valueOf(row.get("d"));
            amountByDay.put(key, new BigDecimal(String.valueOf(row.get("amount"))));
            countByDay.put(key, ((Number) row.get("cnt")).longValue());
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            LocalDate day = start30.toLocalDate().plusDays(i);
            Map<String, Object> point = new HashMap<>();
            point.put("date", day.format(DATE_LABEL));
            point.put("amount", amountByDay.getOrDefault(day.toString(), BigDecimal.ZERO));
            point.put("orders", countByDay.getOrDefault(day.toString(), 0L));
            trend.add(point);
        }

        LocalDateTime start90 = LocalDate.now().minusDays(89).atStartOfDay();
        List<Map<String, Object>> topProducts = jdbc.queryForList(
                "SELECT oi.product_id AS productId, oi.name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.channel_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY oi.product_id, oi.name ORDER BY amount DESC LIMIT 5", id, start90);
        List<Map<String, Object>> recentOrders = jdbc.queryForList(
                "SELECT id, order_no AS orderNo, pay_amount AS payAmount, status, create_time AS createTime "
                        + "FROM s2b2c_order WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') "
                        + "ORDER BY create_time DESC LIMIT 10", id);
        Map<String, Object> commission = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END),0) settled, "
                        + "IFNULL(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END),0) pending "
                        + "FROM s2b2c_commission WHERE channel_id = ?", id);
        Map<String, Object> withdrawal = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN status IN ('PENDING','APPROVED') THEN amount ELSE 0 END),0) processing, "
                        + "IFNULL(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END),0) paid "
                        + "FROM s2b2c_commission_withdrawal WHERE channel_id = ?", id);
        Map<String, Object> commissionSummary = new HashMap<>();
        commissionSummary.put("settled", commission.get("settled"));
        commissionSummary.put("pending", commission.get("pending"));
        commissionSummary.put("withdrawalProcessing", withdrawal.get("processing"));
        commissionSummary.put("withdrawalPaid", withdrawal.get("paid"));

        BigDecimal gmv30 = decimalValue(metric.get("gmv30"));
        long orders30 = longValue(metric.get("orders30"));
        long afterSaleCount = longValue(metric.get("afterSaleCount"));
        long repeatConsumers = longValue(metric.get("repeatConsumers"));
        long distinctConsumers = longValue(metric.get("distinctConsumers"));
        BigDecimal repeatRate = distinctConsumers == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(repeatConsumers).multiply(new BigDecimal("100"))
                .divide(BigDecimal.valueOf(distinctConsumers), 2, RoundingMode.HALF_UP);
        BigDecimal afterSaleRate = orders30 == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(afterSaleCount).multiply(new BigDecimal("100"))
                .divide(BigDecimal.valueOf(orders30), 2, RoundingMode.HALF_UP);
        String health = orders30 == 0 ? "SLEEPING"
                : afterSaleRate.compareTo(new BigDecimal("5")) > 0 ? "RISK"
                : repeatRate.compareTo(new BigDecimal("40")) >= 0 ? "HEALTHY" : "NORMAL";

        Map<String, Object> performance = new HashMap<>();
        performance.put("gmv30", gmv30);
        performance.put("orders30", orders30);
        performance.put("avgOrderAmount", orders30 == 0 ? BigDecimal.ZERO
                : gmv30.divide(BigDecimal.valueOf(orders30), 2, RoundingMode.HALF_UP));
        performance.put("gmvTotal", decimalValue(metric.get("gmvTotal")));
        performance.put("ordersTotal", longValue(metric.get("ordersTotal")));
        performance.put("repeatRate", repeatRate);
        performance.put("afterSaleRate", afterSaleRate);
        performance.put("productCount", longValue(metric.get("productCount")));
        performance.put("consumers", distinctConsumers);
        performance.put("lastOrderTime", metric.get("lastOrderTime"));
        performance.put("health", health);

        Map<String, Object> result = new HashMap<>();
        result.put("channel", channel);
        result.put("performance", performance);
        result.put("trend", trend);
        result.put("topProducts", topProducts);
        result.put("recentOrders", recentOrders);
        result.put("commission", commissionSummary);
        return ResponseEntity.ok(result);
    }

    private Map<Long, Map<String, Object>> aggregateChannelMetrics(LocalDateTime start30) {
        Map<Long, Map<String, Object>> metrics = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT channel_id, COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv, MAX(create_time) last_order "
                        + "FROM s2b2c_order WHERE status NOT IN ('CANCELLED','REFUNDED') AND channel_id IS NOT NULL GROUP BY channel_id")) {
            metrics.computeIfAbsent(((Number) row.get("channel_id")).longValue(), k -> new HashMap<>())
                    .putAll(Map.of("ordersTotal", row.get("orders"), "gmvTotal", row.get("gmv"),
                            "lastOrderTime", row.get("last_order") == null ? "" : row.get("last_order")));
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT channel_id, COUNT(*) orders, IFNULL(SUM(pay_amount),0) gmv FROM s2b2c_order "
                        + "WHERE status NOT IN ('CANCELLED','REFUNDED') AND channel_id IS NOT NULL AND create_time >= ? GROUP BY channel_id",
                start30)) {
            metrics.computeIfAbsent(((Number) row.get("channel_id")).longValue(), k -> new HashMap<>())
                    .putAll(Map.of("orders30", row.get("orders"), "gmv30", row.get("gmv")));
        }
        Map<Long, java.util.Set<Long>> consumers = new HashMap<>();
        Map<Long, java.util.Map<Long, Long>> counts = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT channel_id, consumer_id, COUNT(*) cnt FROM s2b2c_order "
                        + "WHERE status NOT IN ('CANCELLED','REFUNDED') AND channel_id IS NOT NULL AND consumer_id IS NOT NULL "
                        + "GROUP BY channel_id, consumer_id")) {
            Long channelId = ((Number) row.get("channel_id")).longValue();
            Long consumerId = ((Number) row.get("consumer_id")).longValue();
            counts.computeIfAbsent(channelId, k -> new HashMap<>()).put(consumerId, ((Number) row.get("cnt")).longValue());
            consumers.computeIfAbsent(channelId, k -> new java.util.HashSet<>()).add(consumerId);
        }
        for (Map.Entry<Long, java.util.Set<Long>> entry : consumers.entrySet()) {
            long repeat = counts.getOrDefault(entry.getKey(), Map.of()).values().stream()
                    .filter(cnt -> cnt > 1).count();
            metrics.computeIfAbsent(entry.getKey(), k -> new HashMap<>())
                    .putAll(Map.of("distinctConsumers", (long) entry.getValue().size(), "repeatConsumers", repeat));
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT o.channel_id, COUNT(*) cnt FROM s2b2c_after_sale a JOIN s2b2c_order o ON a.order_id = o.id "
                        + "WHERE o.channel_id IS NOT NULL AND a.create_time >= ? GROUP BY o.channel_id", start30)) {
            metrics.computeIfAbsent(((Number) row.get("channel_id")).longValue(), k -> new HashMap<>())
                    .put("afterSaleCount", row.get("cnt"));
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT channel_id, COUNT(*) cnt FROM s2b2c_channel_product "
                        + "WHERE status = 'ACTIVE' GROUP BY channel_id")) {
            metrics.computeIfAbsent(((Number) row.get("channel_id")).longValue(), k -> new HashMap<>())
                    .put("productCount", row.get("cnt"));
        }
        return metrics;
    }

    private long longValue(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }

    private BigDecimal decimalValue(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    }

    private String nullToEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
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

    /** 活动预算：留空=不限；填写时必须是大于 0 的数字。 */
    private BigDecimal parseBudget(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            BigDecimal budget = new BigDecimal(String.valueOf(value).trim());
            if (budget.signum() <= 0) {
                throw new IllegalArgumentException("活动预算必须大于 0（留空表示不限）");
            }
            return budget;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("活动预算必须是数字");
        }
    }

    /** 费用承担方：默认 PLATFORM；非法值返回 null。 */
    private String normalizeCostBearer(Object value) {
        String bearer = text(value).toUpperCase();
        if (bearer.isEmpty()) return "PLATFORM";
        return List.of("PLATFORM", "SUPPLIER", "CHANNEL").contains(bearer) ? bearer : null;
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
        return LocalDateTime.parse(normalized, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    /** 佣金明细报表：按渠道/状态筛选，附汇总。 */
    @GetMapping("/commissions")
    public ResponseEntity<Map<String, Object>> commissions(@RequestParam(required = false) Long channelId,
                                                           @RequestParam(required = false) String status,
                                                           @RequestParam(defaultValue = "1") int page,
                                                           @RequestParam(defaultValue = "10") int size) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (channelId != null) {
            where.append(" AND cm.channel_id = ?");
            args.add(channelId);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND cm.status = ?");
            args.add(status);
        }
        Map<String, Object> summary = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN cm.status = 'SETTLED' THEN cm.amount ELSE 0 END),0) settled, "
                        + "IFNULL(SUM(CASE WHEN cm.status = 'PENDING' THEN cm.amount ELSE 0 END),0) pending, "
                        + "COUNT(*) total FROM s2b2c_commission cm" + where, args.toArray());
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_commission cm" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((page - 1) * size);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT cm.id, cm.order_id AS orderId, o.order_no AS orderNo, cm.channel_id AS channelId, "
                        + "c.shop_name AS channelName, cm.amount, cm.rate, cm.status, cm.settle_batch_no AS settleBatchNo, "
                        + "cm.remark, cm.settle_time AS settleTime, cm.create_time AS createTime "
                        + "FROM s2b2c_commission cm LEFT JOIN s2b2c_order o ON cm.order_id = o.id "
                        + "LEFT JOIN s2b2c_channel_partner c ON cm.channel_id = c.id"
                        + where + " ORDER BY cm.create_time DESC LIMIT ? OFFSET ?", pageArgs.toArray());
        Map<String, Object> result = new HashMap<>();
        result.put("records", rows);
        result.put("total", total);
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }

    /** 价格与价盘：供货价 + 渠道成交价区间，标记低于供货价与异常高加价。 */
    @GetMapping("/price-center")
    public ResponseEntity<Map<String, Object>> priceCenter(@RequestParam(required = false) String keyword) {
        StringBuilder sql = new StringBuilder(
                "SELECT p.id, p.name, p.price, p.stock, p.status, p.supplier_id AS supplierId, "
                        + "p.min_retail_price AS minRetailPrice, p.max_retail_price AS maxRetailPrice, "
                        + "s.company_name AS supplierName, c.name AS categoryName "
                        + "FROM s2b2c_product p LEFT JOIN s2b2c_supplier s ON p.supplier_id = s.id "
                        + "LEFT JOIN s2b2c_category c ON p.category_id = c.id WHERE p.status = 'APPROVED'");
        List<Object> args = new ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND p.name LIKE ?");
            args.add("%" + keyword.trim() + "%");
        }
        sql.append(" ORDER BY p.update_time DESC LIMIT 200");
        List<Map<String, Object>> products = jdbc.queryForList(sql.toString(), args.toArray());
        int anomalies = 0;
        for (Map<String, Object> product : products) {
            Object productId = product.get("id");
            List<Map<String, Object>> relations = jdbc.queryForList(
                    "SELECT retail_price, shelf_status FROM s2b2c_channel_product "
                            + "WHERE product_id = ? AND status = 'ACTIVE'", productId);
            BigDecimal supply = new BigDecimal(String.valueOf(product.get("price")));
            BigDecimal min = null;
            BigDecimal max = null;
            int belowSupply = 0;
            int listing = 0;
            int onShelf = 0;
            for (Map<String, Object> relation : relations) {
                BigDecimal effective = relation.get("retail_price") == null
                        ? supply : new BigDecimal(String.valueOf(relation.get("retail_price")));
                if (min == null || effective.compareTo(min) < 0) min = effective;
                if (max == null || effective.compareTo(max) > 0) max = effective;
                if (effective.compareTo(supply) < 0) belowSupply++;
                listing++;
                if (!"OFF".equalsIgnoreCase(String.valueOf(relation.get("shelf_status")))) onShelf++;
            }
            product.put("listingCount", listing);
            product.put("onShelfCount", onShelf);
            product.put("minRetail", min);
            product.put("maxRetail", max);
            product.put("belowSupplyCount", belowSupply);
            String anomaly = "OK";
            if (belowSupply > 0) anomaly = "BELOW_SUPPLY";
            else if (max != null && max.compareTo(supply.multiply(new BigDecimal("3"))) > 0) anomaly = "HIGH_MARKUP";
            product.put("anomaly", anomaly);
            if (!"OK".equals(anomaly)) anomalies++;
        }
        if (!products.isEmpty()) {
            List<Long> ids = products.stream().map((row) -> ((Number) row.get("id")).longValue()).toList();
            String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
            Map<Long, List<String>> regionMap = new HashMap<>();
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT product_id, region_name FROM s2b2c_distribution_region WHERE product_id IN ("
                            + placeholders + ") ORDER BY create_time, id", ids.toArray())) {
                regionMap.computeIfAbsent(((Number) row.get("product_id")).longValue(), key -> new ArrayList<>())
                        .add(String.valueOf(row.get("region_name")));
            }
            for (Map<String, Object> product : products) {
                product.put("regionNames", regionMap.getOrDefault(
                        ((Number) product.get("id")).longValue(), List.of()));
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("records", products);
        result.put("anomalies", anomalies);
        result.put("total", products.size());
        return ResponseEntity.ok(result);
    }

    /** 全量价盘巡检：扫描全部已审核商品，把低于底价的渠道货架自动下架并留痕。 */
    @PostMapping("/price-guard/scan")
    public ResponseEntity<Map<String, Object>> scanPriceGuard() {
        Map<String, Object> result = new LinkedHashMap<>(priceGuardService.scanAll("MANUAL"));
        int offShelf = ((Number) result.getOrDefault("offShelf", 0)).intValue();
        result.put("success", true);
        result.put("message", offShelf > 0
                ? "巡检完成：扫描 " + result.get("scanned") + " 个商品，自动下架 " + offShelf + " 个低于底价的渠道货架"
                : "巡检完成：未发现需要下架的渠道货架");
        return ResponseEntity.ok(result);
    }

    /** 价盘巡检记录（最新在前），含今日自动下架数。 */
    @GetMapping("/price-guard/records")
    public ResponseEntity<Map<String, Object>> priceGuardRecords(@RequestParam(defaultValue = "50") int limit) {
        int size = Math.min(Math.max(limit, 1), 200);
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT l.id, l.product_id AS productId, l.product_name AS productName, "
                        + "l.supplier_id AS supplierId, s.company_name AS supplierName, "
                        + "l.channel_id AS channelId, c.shop_name AS channelName, "
                        + "l.retail_price AS retailPrice, l.floor_price AS floorPrice, l.action, "
                        + "l.trigger_source AS triggerSource, l.create_time AS createTime "
                        + "FROM s2b2c_price_guard_log l "
                        + "LEFT JOIN s2b2c_supplier s ON s.id = l.supplier_id "
                        + "LEFT JOIN s2b2c_channel_partner c ON c.id = l.channel_id "
                        + "ORDER BY l.create_time DESC, l.id DESC LIMIT ?", size);
        Long today = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_price_guard_log WHERE create_time >= CURDATE()", Long.class);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", records);
        result.put("todayOffShelf", today == null ? 0 : today);
        result.put("total", records.size());
        return ResponseEntity.ok(result);
    }

    /**
     * 创建优惠券。预算、承担方与审核流尚未建模，因此创建即生效；停用走状态接口。
     */
    @PostMapping("/coupons")
    public ResponseEntity<Map<String, Object>> createCoupon(@RequestBody Map<String, Object> body) {
        String name = text(body.get("name"));
        if (name.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写优惠券名称"));
        }
        String type = text(body.get("type")).isEmpty() ? "FIXED" : text(body.get("type")).toUpperCase();
        if (!List.of("FIXED", "DISCOUNT").contains(type)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "类型只能是 FIXED / DISCOUNT"));
        }
        BigDecimal amount = decimal(body.get("amount"), BigDecimal.ZERO);
        BigDecimal discountRate = decimal(body.get("discountRate"), null);
        BigDecimal minAmount = decimal(body.get("minAmount"), BigDecimal.ZERO);
        int totalCount = integer(body.get("totalCount"), 1000);
        int perUserLimit = integer(body.get("perUserLimit"), 1);
        LocalDate validStart;
        LocalDate validEnd;
        try {
            validStart = LocalDate.parse(text(body.get("validStart")));
            validEnd = LocalDate.parse(text(body.get("validEnd")));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "有效期格式应为 YYYY-MM-DD"));
        }
        if (validEnd.isBefore(validStart)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "结束日期不能早于开始日期"));
        }
        if ("FIXED".equals(type) && amount.signum() <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "满减券面额必须大于 0"));
        }
        if ("DISCOUNT".equals(type) && (discountRate == null || discountRate.signum() <= 0
                || discountRate.compareTo(new BigDecimal("10")) >= 0)) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "折扣需大于 0 且小于 10（如 9.5 表示 95 折）"));
        }
        if (totalCount <= 0 || perUserLimit <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "发行量与限领数量必须大于 0"));
        }
        BigDecimal budget;
        try {
            budget = parseBudget(body.get("budget"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
        }
        String costBearer = normalizeCostBearer(body.get("costBearer"));
        if (costBearer == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "费用承担方只能是 PLATFORM / SUPPLIER / CHANNEL"));
        }
        Long id = IdWorker.getId();
        jdbc.update("INSERT INTO s2b2c_coupon (id, name, type, amount, discount_rate, min_amount, total_count, "
                        + "remain_count, per_user_limit, valid_start, valid_end, applicable_scope, status, "
                        + "budget, budget_used, cost_bearer, create_time) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?,?,'ALL','ACTIVE',?,0,?,NOW())",
                id, name, type, amount, discountRate, minAmount, totalCount, totalCount, perUserLimit,
                validStart, validEnd, budget, costBearer);
        return ResponseEntity.ok(Map.of("success", true, "message", "优惠券已创建", "id", String.valueOf(id)));
    }

    @PutMapping("/coupons/{id}/status")
    public ResponseEntity<Map<String, Object>> updateCouponStatus(@PathVariable Long id,
                                                                  @RequestParam String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("ACTIVE", "ENDED").contains(normalized)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 ACTIVE / ENDED"));
        }
        int updated = jdbc.update("UPDATE s2b2c_coupon SET status = ? WHERE id = ?", normalized, id);
        return ResponseEntity.ok(Map.of("success", updated > 0, "message", updated > 0 ? "状态已更新" : "优惠券不存在"));
    }

    /** 创建秒杀：活动价必须低于商品现价。 */
    @PostMapping("/flash-sales")
    public ResponseEntity<Map<String, Object>> createFlashSale(@RequestBody Map<String, Object> body) {
        Long productId = longObject(body.get("productId"));
        BigDecimal salePrice = decimal(body.get("salePrice"), BigDecimal.ZERO);
        int totalStock = integer(body.get("totalStock"), 0);
        int perUserLimit = integer(body.get("perUserLimit"), 1);
        LocalDateTime start;
        LocalDateTime end;
        try {
            start = parseDateTime(text(body.get("startTime")));
            end = parseDateTime(text(body.get("endTime")));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "活动时间格式应为 YYYY-MM-DD HH:mm:ss"));
        }
        if (productId == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请选择商品"));
        }
        if (end.isBefore(start) || end.isBefore(LocalDateTime.now())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "结束时间需晚于开始时间且未过期"));
        }
        if (totalStock <= 0 || perUserLimit <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "活动库存与限购必须大于 0"));
        }
        Map<String, Object> product = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, name, price, status FROM s2b2c_product WHERE id = ?", productId)) {
            product = row;
        }
        if (product == null || !"APPROVED".equals(String.valueOf(product.get("status")))) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不存在或未审核通过"));
        }
        BigDecimal original = new BigDecimal(String.valueOf(product.get("price")));
        if (salePrice.signum() <= 0 || salePrice.compareTo(original) >= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "秒杀价必须大于 0 且低于商品现价"));
        }
        BigDecimal budget;
        try {
            budget = parseBudget(body.get("budget"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
        }
        String costBearer = normalizeCostBearer(body.get("costBearer"));
        if (costBearer == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "费用承担方只能是 PLATFORM / SUPPLIER / CHANNEL"));
        }
        String status = start.isAfter(LocalDateTime.now()) ? "UPCOMING" : "ACTIVE";
        Long id = IdWorker.getId();
        jdbc.update("INSERT INTO s2b2c_flash_sale (id, product_id, sale_price, original_price, start_time, end_time, "
                        + "total_stock, remain_stock, per_user_limit, status, budget, budget_used, cost_bearer, create_time) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,NOW())",
                id, productId, salePrice, original, start, end, totalStock, totalStock, perUserLimit, status,
                budget, costBearer);
        return ResponseEntity.ok(Map.of("success", true, "message", "秒杀活动已创建", "id", String.valueOf(id)));
    }

    @PutMapping("/flash-sales/{id}/status")
    public ResponseEntity<Map<String, Object>> updateFlashStatus(@PathVariable Long id,
                                                                 @RequestParam String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("ACTIVE", "ENDED").contains(normalized)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 ACTIVE / ENDED"));
        }
        int updated = jdbc.update("UPDATE s2b2c_flash_sale SET status = ? WHERE id = ?", normalized, id);
        return ResponseEntity.ok(Map.of("success", updated > 0, "message", updated > 0 ? "状态已更新" : "活动不存在"));
    }

    /** 创建拼团：团价低于单买价，成团人数 2-10。 */
    @PostMapping("/group-buys")
    public ResponseEntity<Map<String, Object>> createGroupBuy(@RequestBody Map<String, Object> body) {
        String name = text(body.get("name"));
        Long productId = longObject(body.get("productId"));
        BigDecimal singlePrice = decimal(body.get("singlePrice"), BigDecimal.ZERO);
        BigDecimal groupPrice = decimal(body.get("groupPrice"), BigDecimal.ZERO);
        BigDecimal leaderPrice = decimal(body.get("leaderPrice"), null);
        int groupSize = integer(body.get("groupSize"), 3);
        int perUserLimit = integer(body.get("perUserLimit"), 1);
        int validHours = integer(body.get("validHours"), 24);
        LocalDateTime start;
        LocalDateTime end;
        try {
            start = parseDateTime(text(body.get("startTime")));
            end = parseDateTime(text(body.get("endTime")));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "活动时间格式应为 YYYY-MM-DD HH:mm:ss"));
        }
        if (name.isEmpty() || productId == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写活动名称并选择商品"));
        }
        if (groupSize < 2 || groupSize > 10) {
            return ResponseEntity.ok(Map.of("success", false, "message", "成团人数需在 2-10 之间"));
        }
        if (validHours < 1 || validHours > 168) {
            return ResponseEntity.ok(Map.of("success", false, "message", "成团有效期需在 1-168 小时之间"));
        }
        if (singlePrice.signum() <= 0 || groupPrice.signum() <= 0 || groupPrice.compareTo(singlePrice) >= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "拼团价必须大于 0 且低于单买价"));
        }
        if (leaderPrice != null && (leaderPrice.signum() <= 0 || leaderPrice.compareTo(groupPrice) > 0)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "团长价需大于 0 且不高于拼团价"));
        }
        if (end.isBefore(start) || end.isBefore(LocalDateTime.now())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "结束时间需晚于开始时间且未过期"));
        }
        Map<String, Object> product = null;
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, status FROM s2b2c_product WHERE id = ?", productId)) {
            product = row;
        }
        if (product == null || !"APPROVED".equals(String.valueOf(product.get("status")))) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不存在或未审核通过"));
        }
        BigDecimal budget;
        try {
            budget = parseBudget(body.get("budget"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
        }
        String costBearer = normalizeCostBearer(body.get("costBearer"));
        if (costBearer == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "费用承担方只能是 PLATFORM / SUPPLIER / CHANNEL"));
        }
        String status = start.isAfter(LocalDateTime.now()) ? "UPCOMING" : "ACTIVE";
        Long id = IdWorker.getId();
        jdbc.update("INSERT INTO s2b2c_group_buy (id, name, product_id, single_price, group_price, leader_price, "
                        + "group_size, per_user_limit, valid_hours, start_time, end_time, status, "
                        + "budget, budget_used, cost_bearer, create_time) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,NOW())",
                id, name, productId, singlePrice, groupPrice, leaderPrice, groupSize, perUserLimit,
                validHours, start, end, status, budget, costBearer);
        return ResponseEntity.ok(Map.of("success", true, "message", "拼团活动已创建", "id", String.valueOf(id)));
    }

    @PutMapping("/group-buys/{id}/status")
    public ResponseEntity<Map<String, Object>> updateGroupStatus(@PathVariable Long id,
                                                                 @RequestParam String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("ACTIVE", "ENDED").contains(normalized)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 ACTIVE / ENDED"));
        }
        int updated = jdbc.update("UPDATE s2b2c_group_buy SET status = ? WHERE id = ?", normalized, id);
        return ResponseEntity.ok(Map.of("success", updated > 0, "message", updated > 0 ? "状态已更新" : "活动不存在"));
    }

    /**
     * 单个活动监控。
     *
     * <p>归因说明：优惠券按 coupon_user.order_id 关联；秒杀按“商品 + 活动时间窗内订单”近似；
     * 拼团按 group_buy_order.order_id 关联。三种口径都不是活动主键级归因（订单没有 activity_id），
     * 页面必须标注为近似值。</p>
     */
    @GetMapping("/activities/{type}/{id}/monitor")
    public ResponseEntity<Map<String, Object>> activityMonitor(@PathVariable String type,
                                                               @PathVariable Long id) {
        String kind = type == null ? "" : type.trim().toUpperCase();
        Map<String, Object> result = new HashMap<>();
        if ("COUPON".equals(kind)) {
            Map<String, Object> coupon = null;
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT id, name, type, amount, discount_rate AS discountRate, min_amount AS minAmount, "
                            + "total_count AS totalCount, remain_count AS remainCount, valid_start AS validStart, "
                            + "valid_end AS validEnd, status, budget, budget_used AS budgetUsed, "
                            + "cost_bearer AS costBearer FROM s2b2c_coupon WHERE id = ?", id)) {
                coupon = row;
            }
            if (coupon == null) {
                return ResponseEntity.status(404).body(Map.of("message", "优惠券不存在"));
            }
            long received = longValue(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM s2b2c_coupon_user WHERE coupon_id = ?", Long.class, id));
            long used = longValue(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM s2b2c_coupon_user WHERE coupon_id = ? AND status = 'USED'", Long.class, id));
            BigDecimal gmv = decimalValue(jdbc.queryForObject(
                    "SELECT IFNULL(SUM(o.pay_amount),0) FROM s2b2c_coupon_user u "
                            + "JOIN s2b2c_order o ON (o.coupon_user_id = u.id OR o.id = u.order_id) "
                            + "WHERE u.coupon_id = ? AND u.status = 'USED' AND o.status NOT IN ('CANCELLED','REFUNDED')",
                    BigDecimal.class, id));
            BigDecimal couponDiscount = decimalValue(jdbc.queryForObject(
                    "SELECT IFNULL(SUM(o.coupon_discount),0) FROM s2b2c_coupon_user u "
                            + "JOIN s2b2c_order o ON (o.coupon_user_id = u.id OR o.id = u.order_id) "
                            + "WHERE u.coupon_id = ? AND u.status = 'USED' AND o.status NOT IN ('CANCELLED','REFUNDED')",
                    BigDecimal.class, id));
            List<Map<String, Object>> recentOrders = jdbc.queryForList(
                    "SELECT DISTINCT o.id, o.order_no AS orderNo, o.pay_amount AS payAmount, "
                            + "o.coupon_discount AS couponDiscount, o.status, o.create_time AS createTime "
                            + "FROM s2b2c_coupon_user u JOIN s2b2c_order o ON (o.coupon_user_id = u.id OR o.id = u.order_id) "
                            + "WHERE u.coupon_id = ? ORDER BY o.create_time DESC LIMIT 10", id);
            Map<String, Object> metrics = new HashMap<>();
            metrics.put("received", received);
            metrics.put("used", used);
            metrics.put("usageRate", received == 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(used).multiply(new BigDecimal("100"))
                    .divide(BigDecimal.valueOf(received), 2, RoundingMode.HALF_UP));
            metrics.put("gmv", gmv);
            metrics.put("discountAmount", couponDiscount);
            putBudgetMetrics(metrics, coupon);
            result.put("kind", "COUPON");
            result.put("activity", coupon);
            result.put("metrics", metrics);
            result.put("recentOrders", recentOrders);
            result.put("attribution", "券核销订单归因（子单 coupon_user_id；拆单优惠按子单分摊）");
            return ResponseEntity.ok(result);
        }
        if ("FLASH".equals(kind)) {
            Map<String, Object> flash = null;
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT f.id, f.product_id AS productId, p.name AS productName, f.sale_price AS salePrice, "
                            + "f.original_price AS originalPrice, f.start_time AS startTime, f.end_time AS endTime, "
                            + "f.total_stock AS totalStock, f.remain_stock AS remainStock, f.status, "
                            + "f.budget, f.budget_used AS budgetUsed, f.cost_bearer AS costBearer "
                            + "FROM s2b2c_flash_sale f LEFT JOIN s2b2c_product p ON f.product_id = p.id WHERE f.id = ?", id)) {
                flash = row;
            }
            if (flash == null) {
                return ResponseEntity.status(404).body(Map.of("message", "秒杀活动不存在"));
            }
            long sold = longValue(flash.get("totalStock")) - longValue(flash.get("remainStock"));
            LocalDateTime start = toDateTime(flash.get("startTime"));
            LocalDateTime end = toDateTime(flash.get("endTime"));
            long exactAttributionRows = longValue(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM s2b2c_order_item oi JOIN s2b2c_order o ON o.id = oi.order_id "
                            + "WHERE oi.flash_sale_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED')",
                    Long.class, flash.get("id")));
            List<Map<String, Object>> orders;
            if (exactAttributionRows > 0) {
                orders = jdbc.queryForList(
                        "SELECT DISTINCT o.id, o.order_no AS orderNo, o.pay_amount AS payAmount, o.status, "
                                + "o.create_time AS createTime FROM s2b2c_order_item oi "
                                + "JOIN s2b2c_order o ON oi.order_id = o.id "
                                + "WHERE oi.flash_sale_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') "
                                + "ORDER BY o.create_time DESC LIMIT 20", flash.get("id"));
            } else {
                orders = jdbc.queryForList(
                        "SELECT DISTINCT o.id, o.order_no AS orderNo, o.pay_amount AS payAmount, o.status, "
                                + "o.create_time AS createTime FROM s2b2c_order o "
                                + "JOIN s2b2c_order_item oi ON oi.order_id = o.id "
                                + "WHERE oi.product_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') "
                                + "AND o.create_time >= ? AND o.create_time <= ? ORDER BY o.create_time DESC LIMIT 20",
                        flash.get("productId"), start, end);
            }
            BigDecimal gmv = orders.stream().map(row -> decimalValue(row.get("payAmount")))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> metrics = new HashMap<>();
            metrics.put("sold", sold);
            metrics.put("totalStock", flash.get("totalStock"));
            metrics.put("remainStock", flash.get("remainStock"));
            metrics.put("sellThrough", longValue(flash.get("totalStock")) == 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(sold).multiply(new BigDecimal("100"))
                    .divide(BigDecimal.valueOf(longValue(flash.get("totalStock"))), 2, RoundingMode.HALF_UP));
            metrics.put("orderCount", (long) orders.size());
            metrics.put("gmv", gmv);
            putBudgetMetrics(metrics, flash);
            result.put("kind", "FLASH");
            result.put("activity", flash);
            result.put("metrics", metrics);
            result.put("recentOrders", orders.size() > 10 ? orders.subList(0, 10) : orders);
            result.put("attribution", exactAttributionRows > 0
                    ? "秒杀订单（order_item.flash_sale_id）"
                    : "历史订单按商品 + 活动时间窗近似（订单无秒杀主键）");
            return ResponseEntity.ok(result);
        }
        if ("GROUP".equals(kind)) {
            Map<String, Object> group = null;
            for (Map<String, Object> row : jdbc.queryForList(
                    "SELECT g.id, g.name, g.product_id AS productId, p.name AS productName, "
                            + "g.single_price AS singlePrice, g.group_price AS groupPrice, g.group_size AS groupSize, "
                            + "g.valid_hours AS validHours, g.start_time AS startTime, g.end_time AS endTime, g.status, "
                            + "g.budget, g.budget_used AS budgetUsed, g.cost_bearer AS costBearer "
                            + "FROM s2b2c_group_buy g LEFT JOIN s2b2c_product p ON g.product_id = p.id WHERE g.id = ?", id)) {
                group = row;
            }
            if (group == null) {
                return ResponseEntity.status(404).body(Map.of("message", "拼团活动不存在"));
            }
            long instances = longValue(jdbc.queryForObject(
                    "SELECT COUNT(DISTINCT instance_id) FROM s2b2c_group_buy_order WHERE group_id = ?", Long.class, id));
            long participants = longValue(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM s2b2c_group_buy_order WHERE group_id = ?", Long.class, id));
            List<Map<String, Object>> orders = jdbc.queryForList(
                    "SELECT DISTINCT o.id, o.order_no AS orderNo, o.pay_amount AS payAmount, o.status, o.create_time AS createTime "
                            + "FROM s2b2c_group_buy_order g JOIN s2b2c_order o ON g.order_id = o.id "
                            + "WHERE g.group_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') "
                            + "ORDER BY o.create_time DESC LIMIT 20", id);
            BigDecimal gmv = orders.stream().map(row -> decimalValue(row.get("payAmount")))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> metrics = new HashMap<>();
            metrics.put("instances", instances);
            metrics.put("participants", participants);
            metrics.put("orderCount", (long) orders.size());
            metrics.put("gmv", gmv);
            putBudgetMetrics(metrics, group);
            result.put("kind", "GROUP");
            result.put("activity", group);
            result.put("metrics", metrics);
            result.put("recentOrders", orders.size() > 10 ? orders.subList(0, 10) : orders);
            result.put("attribution", "拼团订单（group_buy_order.order_id）");
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", "类型只能是 COUPON / FLASH / GROUP"));
    }

    private LocalDateTime toDateTime(Object value) {
        if (value == null) {
            return LocalDateTime.now();
        }
        if (value instanceof LocalDateTime local) {
            return local;
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        return LocalDateTime.parse(String.valueOf(value).replace(' ', 'T'));
    }

    /** 监控弹窗统一补充预算/已用/剩余（budget 为空表示不限）。 */
    private void putBudgetMetrics(Map<String, Object> metrics, Map<String, Object> activity) {
        BigDecimal budget = activity.get("budget") == null ? null : decimalValue(activity.get("budget"));
        BigDecimal used = decimalValue(activity.get("budgetUsed"));
        metrics.put("budget", budget);
        metrics.put("budgetUsed", used);
        metrics.put("budgetRemain", budget == null ? null : budget.subtract(used).max(BigDecimal.ZERO));
    }

    /** 评价审核：查看全部评价并按需隐藏/恢复。 */
    @GetMapping("/reviews")
    public ResponseEntity<Map<String, Object>> reviews(
            @RequestParam(required = false) Boolean hidden,
            @RequestParam(required = false) Integer rating,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 50);
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (hidden != null) {
            where.append(" AND r.hidden = ?");
            args.add(hidden ? 1 : 0);
        }
        if (rating != null) {
            where.append(" AND r.rating = ?");
            args.add(rating);
        }
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_review r" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add((safePage - 1) * safeSize);
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT r.id, r.order_id AS orderId, o.order_no AS orderNo, r.product_id AS productId, "
                        + "p.name AS productName, s.company_name AS supplierName, o.channel_id AS channelId, "
                        + "c.shop_name AS channelName, c2.nickname, r.rating, r.content, r.tags, r.images, "
                        + "r.anonymous, r.reply, r.reply_time AS replyTime, r.reply_by AS replyBy, r.hidden, "
                        + "r.create_time AS createTime FROM s2b2c_review r "
                        + "LEFT JOIN s2b2c_order o ON o.id = r.order_id "
                        + "LEFT JOIN s2b2c_product p ON p.id = r.product_id "
                        + "LEFT JOIN s2b2c_supplier s ON s.id = p.supplier_id "
                        + "LEFT JOIN s2b2c_channel_partner c ON c.id = o.channel_id "
                        + "LEFT JOIN s2b2c_consumer c2 ON c2.id = r.consumer_id" + where
                        + " ORDER BY r.create_time DESC, r.id DESC LIMIT ? OFFSET ?", pageArgs.toArray());
        for (Map<String, Object> row : records) {
            if (Boolean.TRUE.equals(row.get("anonymous"))) row.put("nickname", null);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("records", records);
        result.put("total", total == null ? 0 : total);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/review/{id}/hide")
    public ResponseEntity<Map<String, Object>> hideReview(@PathVariable Long id,
                                                          @RequestParam boolean hidden) {
        int updated = jdbc.update("UPDATE s2b2c_review SET hidden = ? WHERE id = ?", hidden ? 1 : 0, id);
        return ResponseEntity.ok(Map.of("success", updated > 0,
                "message", updated > 0 ? (hidden ? "评价已隐藏" : "评价已恢复展示") : "评价不存在"));
    }

/** 手动同步营销活动状态：过期券结束、秒杀/拼团按时间窗开始/结束。 */
    @PostMapping("/marketing/sync-status")
    public ResponseEntity<Map<String, Object>> syncMarketingStatus() {
        Map<String, Object> result = new LinkedHashMap<>(marketingStatusService.sync());
        result.put("success", true);
        result.put("message", "活动状态已同步");
        return ResponseEntity.ok(result);
    }

    /** 营销活动（只读）：优惠券、秒杀、拼团。 */
    @GetMapping("/activities")
    public ResponseEntity<Map<String, Object>> activities() {
        List<Map<String, Object>> coupons = jdbc.queryForList(
                "SELECT c.id, c.name, c.type, c.amount, c.discount_rate AS discountRate, c.min_amount AS minAmount, "
                        + "c.total_count AS totalCount, c.remain_count AS remainCount, c.per_user_limit AS perUserLimit, "
                        + "c.valid_start AS validStart, c.valid_end AS validEnd, c.status, "
                        + "c.budget, c.budget_used AS budgetUsed, c.cost_bearer AS costBearer, "
                        + "(SELECT COUNT(*) FROM s2b2c_coupon_user u WHERE u.coupon_id = c.id) received, "
                        + "(SELECT COUNT(*) FROM s2b2c_coupon_user u WHERE u.coupon_id = c.id AND u.status = 'USED') used "
                        + "FROM s2b2c_coupon c ORDER BY c.create_time DESC");
        List<Map<String, Object>> flashes = jdbc.queryForList(
                "SELECT f.id, p.name AS productName, f.sale_price AS salePrice, f.original_price AS originalPrice, "
                        + "f.start_time AS startTime, f.end_time AS endTime, f.total_stock AS totalStock, "
                        + "f.remain_stock AS remainStock, f.per_user_limit AS perUserLimit, f.status, "
                        + "f.budget, f.budget_used AS budgetUsed, f.cost_bearer AS costBearer "
                        + "FROM s2b2c_flash_sale f LEFT JOIN s2b2c_product p ON f.product_id = p.id "
                        + "ORDER BY f.create_time DESC");
        List<Map<String, Object>> groups = jdbc.queryForList(
                "SELECT g.id, g.name, p.name AS productName, g.single_price AS singlePrice, g.group_price AS groupPrice, "
                        + "g.group_size AS groupSize, g.valid_hours AS validHours, g.start_time AS startTime, "
                        + "g.end_time AS endTime, g.status, "
                        + "g.budget, g.budget_used AS budgetUsed, g.cost_bearer AS costBearer "
                        + "FROM s2b2c_group_buy g LEFT JOIN s2b2c_product p ON g.product_id = p.id "
                        + "ORDER BY g.create_time DESC");
        Map<String, Object> summary = new HashMap<>();
        summary.put("couponActive", coupons.stream().filter(r -> "ACTIVE".equals(String.valueOf(r.get("status")))).count());
        summary.put("couponReceived", coupons.stream().mapToLong(r -> ((Number) r.getOrDefault("received", 0)).longValue()).sum());
        summary.put("couponUsed", coupons.stream().mapToLong(r -> ((Number) r.getOrDefault("used", 0)).longValue()).sum());
        summary.put("flashActive", flashes.stream().filter(r -> "ACTIVE".equals(String.valueOf(r.get("status")))).count());
        summary.put("groupActive", groups.stream().filter(r -> "ACTIVE".equals(String.valueOf(r.get("status")))).count());
        Map<String, Object> result = new HashMap<>();
        result.put("coupons", coupons);
        result.put("flashes", flashes);
        result.put("groups", groups);
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }
}
