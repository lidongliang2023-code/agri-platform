package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.Address;
import com.agri.s2b2c.entity.AfterSale;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Commission;
import com.agri.s2b2c.entity.Consumer;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.OrderItem;
import com.agri.s2b2c.mapper.AddressMapper;
import com.agri.s2b2c.mapper.AfterSaleMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.CommissionMapper;
import com.agri.s2b2c.mapper.ConsumerMapper;
import com.agri.s2b2c.mapper.OrderItemMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.AfterSaleRefundService;
import com.agri.s2b2c.service.ChannelGradeService;
import com.agri.s2b2c.service.ChannelIdentityService;
import com.agri.s2b2c.service.OrderShipmentService;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 渠道商经营台：订单详情与履约、售后、客户、经营分析、对账单。
 *
 * <p>所有查询都以当前渠道档案为边界，跨渠道数据一律 403；商品主数据、区域分润、
 * 溯源与账号实名仍归各自模块，本控制器只做引用与经营结果汇总。</p>
 */
@RestController
@RequestMapping("/api/channel")
@OperatorOnly("s2b2c:channel")
public class ChannelOpsController {

    private static final DateTimeFormatter DATE_LABEL = DateTimeFormatter.ofPattern("MM-dd");

    private final ChannelIdentityService channelIdentityService;
    private final JdbcTemplate jdbc;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final ConsumerMapper consumerMapper;
    private final CommissionMapper commissionMapper;
    private final AfterSaleMapper afterSaleMapper;
    private final AddressMapper addressMapper;
    private final ChannelProductMapper channelProductMapper;
    private final ProductMapper productMapper;
    private final OrderShipmentService shipmentService;
    private final AfterSaleRefundService afterSaleRefundService;
    private final ChannelGradeService channelGradeService;

    public ChannelOpsController(ChannelIdentityService channelIdentityService, JdbcTemplate jdbc,
                                OrderMapper orderMapper, OrderItemMapper orderItemMapper,
                                ConsumerMapper consumerMapper, CommissionMapper commissionMapper,
                                AfterSaleMapper afterSaleMapper, AddressMapper addressMapper,
                                ChannelProductMapper channelProductMapper, ProductMapper productMapper,
                                OrderShipmentService shipmentService,
                                AfterSaleRefundService afterSaleRefundService,
                                ChannelGradeService channelGradeService) {
        this.channelIdentityService = channelIdentityService;
        this.jdbc = jdbc;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.consumerMapper = consumerMapper;
        this.commissionMapper = commissionMapper;
        this.afterSaleMapper = afterSaleMapper;
        this.addressMapper = addressMapper;
        this.channelProductMapper = channelProductMapper;
        this.productMapper = productMapper;
        this.shipmentService = shipmentService;
        this.afterSaleRefundService = afterSaleRefundService;
        this.channelGradeService = channelGradeService;
    }

    /** 订单状态计数、今日 GMV、待办数（看板与履约台共用）。 */
    @GetMapping("/order-stats")
    public ResponseEntity<Map<String, Object>> orderStats() {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> byStatus = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT status, COUNT(*) cnt FROM s2b2c_order WHERE channel_id = ? GROUP BY status", mine.getId())) {
            byStatus.put(String.valueOf(row.get("status")), row.get("cnt"));
        }
        result.put("byStatus", byStatus);
        Map<String, Object> today = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) amount FROM s2b2c_order "
                        + "WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND DATE(create_time) = CURDATE()", mine.getId());
        result.put("todayOrders", today.get("orders"));
        result.put("todayAmount", today.get("amount"));
        Long pendingShip = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order WHERE channel_id = ? AND status = 'PENDING_SHIP'", Long.class, mine.getId());
        Long pendingAfterSale = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_after_sale a JOIN s2b2c_order o ON a.order_id = o.id "
                        + "WHERE o.channel_id = ? AND a.status = 'PENDING'", Long.class, mine.getId());
        result.put("pendingShip", pendingShip);
        result.put("pendingAfterSale", pendingAfterSale);
        return ResponseEntity.ok(result);
    }

    /**
     * 渠道改价 / 上下架：只改分销层（channel_product），不改商品主数据。
     *
     * <p>retailPrice 为空串表示恢复按商品价；不传表示不改。售价上限按商品价 5 倍兜底，
     * 避免误输入；标题、图片与卖点归交易撮合，渠道端不提供修改。</p>
     */
    @PutMapping("/product/{productId}/listing")
    public ResponseEntity<Map<String, Object>> updateListing(@PathVariable Long productId,
                                                             @RequestParam(required = false) String retailPrice,
                                                             @RequestParam(required = false) String shelfStatus) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        ChannelProduct relation = channelProductMapper.selectOne(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getChannelId, mine.getId())
                .eq(ChannelProduct::getProductId, productId)
                .last("LIMIT 1"));
        if (relation == null || !"ACTIVE".equals(relation.getStatus())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该商品不在当前渠道的货架上"));
        }
        com.agri.s2b2c.entity.Product product = productMapper.selectById(productId);
        if (product == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不存在"));
        }
        if (shelfStatus != null && !shelfStatus.isBlank()) {
            String normalized = shelfStatus.trim().toUpperCase();
            if (!List.of("ON", "OFF").contains(normalized)) {
                return ResponseEntity.ok(Map.of("success", false, "message", "货架状态只能是 ON / OFF"));
            }
            relation.setShelfStatus(normalized);
        }
        if (retailPrice != null) {
            if (retailPrice.isBlank()) {
                relation.setRetailPrice(null);
            } else {
                BigDecimal price;
                try {
                    price = new BigDecimal(retailPrice.trim());
                } catch (RuntimeException e) {
                    return ResponseEntity.ok(Map.of("success", false, "message", "零售价必须是数字"));
                }
                if (price.signum() <= 0) {
                    return ResponseEntity.ok(Map.of("success", false, "message", "零售价必须大于 0"));
                }
                if (product.getMinRetailPrice() != null && price.compareTo(product.getMinRetailPrice()) < 0) {
                    return ResponseEntity.ok(Map.of("success", false,
                            "message", "零售价低于供应商最低限价 ¥" + product.getMinRetailPrice()));
                }
                if (product.getPrice() != null && price.compareTo(product.getPrice()) < 0) {
                    return ResponseEntity.ok(Map.of("success", false,
                            "message", "零售价不能低于供货价 ¥" + product.getPrice()));
                }
                if (product.getMaxRetailPrice() != null && price.compareTo(product.getMaxRetailPrice()) > 0) {
                    return ResponseEntity.ok(Map.of("success", false,
                            "message", "零售价高于供应商最高限价 ¥" + product.getMaxRetailPrice()));
                }
                BigDecimal cap = product.getPrice() == null ? BigDecimal.ZERO
                        : product.getPrice().multiply(new BigDecimal("5"));
                if (cap.signum() > 0 && price.compareTo(cap) > 0) {
                    return ResponseEntity.ok(Map.of("success", false, "message", "零售价不能超过商品价的 5 倍"));
                }
                relation.setRetailPrice(price);
            }
        }
        String finalShelf = relation.getShelfStatus() == null ? "ON" : relation.getShelfStatus();
        if ("ON".equalsIgnoreCase(finalShelf)) {
            BigDecimal effective = relation.getRetailPrice() != null ? relation.getRetailPrice() : product.getPrice();
            BigDecimal floor = product.getPrice();
            if (product.getMinRetailPrice() != null
                    && (floor == null || product.getMinRetailPrice().compareTo(floor) > 0)) {
                floor = product.getMinRetailPrice();
            }
            if (effective != null && floor != null && effective.compareTo(floor) < 0) {
                return ResponseEntity.ok(Map.of("success", false,
                        "message", "当前零售价低于底价（供货价/最低限价 ¥" + floor + "），请先调整价格再上架"));
            }
        }
        channelProductMapper.updateById(relation);
        BigDecimal effective = relation.getRetailPrice() != null && relation.getRetailPrice().signum() > 0
                ? relation.getRetailPrice() : product.getPrice();
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "货架信息已更新");
        result.put("retailPrice", relation.getRetailPrice());
        result.put("shelfStatus", relation.getShelfStatus() == null ? "ON" : relation.getShelfStatus());
        result.put("effectivePrice", effective);
        return ResponseEntity.ok(result);
    }

    /** 渠道订单详情：订单、明细、佣金、售后与（脱敏）买家信息。 */    @GetMapping("/order/{id}")
    public ResponseEntity<Map<String, Object>> orderDetail(@PathVariable Long id) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        if (order.getChannelId() == null || !order.getChannelId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该订单不属于当前渠道");
        }
        Map<String, Object> data = new HashMap<>();
        data.put("order", order);
        data.put("items", orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, id)));
        data.put("commissions", commissionMapper.selectList(new LambdaQueryWrapper<Commission>().eq(Commission::getOrderId, id)));
        data.put("afterSales", afterSaleMapper.selectList(new LambdaQueryWrapper<AfterSale>().eq(AfterSale::getOrderId, id)));
        if (order.getAddressId() != null) {
            Address address = addressMapper.selectById(order.getAddressId());
            if (address != null) {
                Map<String, Object> delivery = new HashMap<>();
                delivery.put("name", address.getName());
                delivery.put("phone", maskPhone(address.getPhone()));
                delivery.put("region", String.join("", nullToEmpty(address.getProvince()),
                        nullToEmpty(address.getCity()), nullToEmpty(address.getDistrict())));
                delivery.put("detail", address.getAddress());
                data.put("address", delivery);
            }
        }
        if (order.getConsumerId() != null) {
            Consumer consumer = consumerMapper.selectById(order.getConsumerId());
            if (consumer != null) {
                Map<String, Object> buyer = new HashMap<>();
                buyer.put("id", consumer.getId());
                buyer.put("nickname", consumer.getNickname());
                buyer.put("phone", maskPhone(consumer.getPhone()));
                buyer.put("memberLevel", consumer.getMemberLevel());
                Long orders = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM s2b2c_order WHERE channel_id = ? AND consumer_id = ? AND status NOT IN ('CANCELLED','REFUNDED')",
                        Long.class, mine.getId(), consumer.getId());
                BigDecimal total = jdbc.queryForObject(
                        "SELECT IFNULL(SUM(pay_amount),0) FROM s2b2c_order WHERE channel_id = ? AND consumer_id = ? AND status NOT IN ('CANCELLED','REFUNDED')",
                        BigDecimal.class, mine.getId(), consumer.getId());
                buyer.put("orderCount", orders);
                buyer.put("totalAmount", total);
                data.put("buyer", buyer);
            }
        }
        return ResponseEntity.ok(data);
    }

    /** 渠道发货：仅待发货可操作，写入物流信息并回传已发货状态。 */
    @PutMapping("/order/{id}/ship")
    public ResponseEntity<Map<String, Object>> ship(@PathVariable Long id,
                                                    @RequestParam String logisticsNo,
                                                    @RequestParam(required = false) String company) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        Order order = orderMapper.selectById(id);
        if (order == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "订单不存在"));
        }
        if (order.getChannelId() == null || !order.getChannelId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该订单不属于当前渠道");
        }
        return ResponseEntity.ok(shipmentService.propose(id, "CHANNEL", mine.getId(), logisticsNo, company));
    }

    /** 售后单列表：按渠道订单归属过滤。 */
    @GetMapping("/after-sales")
    public ResponseEntity<List<Map<String, Object>>> afterSales(@RequestParam(required = false) String status) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.order_id AS orderId, a.order_item_id AS orderItemId, a.consumer_id AS consumerId, "
                        + "a.type, a.reason, a.images, a.amount, a.status, a.handle_opinion AS handleOpinion, "
                        + "a.handle_time AS handleTime, a.return_company AS returnCompany, "
                        + "a.return_logistics_no AS returnLogisticsNo, a.return_shipped_at AS returnShippedAt, "
                        + "a.return_received_at AS returnReceivedAt, a.create_time AS createTime, "
                        + "o.order_no AS orderNo, o.pay_amount AS payAmount "
                        + "FROM s2b2c_after_sale a JOIN s2b2c_order o ON a.order_id = o.id WHERE o.channel_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(mine.getId());
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
                for (OrderItem item : orderItemMapper.selectList(
                        new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, String.valueOf(orderId)))) {
                    names.add(item.getName() + " ×" + item.getQuantity());
                }
            }
            row.put("items", String.join("、", names));
            Object consumerId = row.get("consumerId");
            if (consumerId != null) {
                Consumer consumer = consumerMapper.selectById(String.valueOf(consumerId));
                row.put("buyerName", consumer == null ? null : consumer.getNickname());
                row.put("buyerPhone", consumer == null ? null : maskPhone(consumer.getPhone()));
            }
        }
        return ResponseEntity.ok(rows);
    }

    /** 售后处理：待处理 → 同意/拒绝；仅限本渠道订单。 */
    @PutMapping("/after-sale/{id}/review")
    public ResponseEntity<Map<String, Object>> reviewAfterSale(@PathVariable Long id,
                                                               @RequestParam String status,
                                                               @RequestParam(required = false) String opinion) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        AfterSale row = afterSaleMapper.selectById(id);
        if (row == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "售后单不存在"));
        }
        Order order = orderMapper.selectById(row.getOrderId());
        if (order == null || order.getChannelId() == null || !order.getChannelId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该售后单不属于当前渠道");
        }
        if (!List.of("APPROVED", "REJECTED").contains(status)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "处理结果只能是 APPROVED / REJECTED"));
        }
        AfterSaleRefundService.Result result = "APPROVED".equals(status)
                ? afterSaleRefundService.approve(id, opinion)
                : afterSaleRefundService.reject(id, opinion);
        return ResponseEntity.ok(Map.of("success", result.success(), "message", result.message()));
    }

    /** 渠道等级考核：当前等级、近 N 天有效订单/GMV、考核规则与变更记录。 */
    @GetMapping("/grade-history")
    public ResponseEntity<Map<String, Object>> gradeHistory(@RequestParam(defaultValue = "30") int days) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        return ResponseEntity.ok(channelGradeService.history(mine.getId(), days));
    }

    /** 渠道确认收到退货并触发退款。 */
    @PutMapping("/after-sale/{id}/confirm-return")
    public ResponseEntity<Map<String, Object>> confirmReturn(@PathVariable Long id,
                                                             @RequestParam(required = false) String opinion) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        AfterSale row = afterSaleMapper.selectById(id);
        if (row == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "售后单不存在"));
        }
        Order order = orderMapper.selectById(row.getOrderId());
        if (order == null || order.getChannelId() == null || !order.getChannelId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该售后单不属于当前渠道");
        }
        AfterSaleRefundService.Result result = afterSaleRefundService.confirmReturn(id, opinion);
        return ResponseEntity.ok(Map.of("success", result.success(), "message", result.message()));
    }

    /** 评价管理：本渠道订单评价与渠道回复。 */
    @GetMapping("/reviews")
    public ResponseEntity<Map<String, Object>> reviews(
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) Boolean replied,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 50);
        StringBuilder where = new StringBuilder(" WHERE o.channel_id = ?");
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
                "SELECT COUNT(*) FROM s2b2c_review r JOIN s2b2c_order o ON o.id = r.order_id" + where,
                Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add((safePage - 1) * safeSize);
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT r.id, r.order_id AS orderId, o.order_no AS orderNo, r.product_id AS productId, "
                        + "p.name AS productName, c.nickname, r.rating, r.content, r.tags, r.images, r.anonymous, "
                        + "r.reply, r.reply_time AS replyTime, r.reply_by AS replyBy, r.create_time AS createTime "
                        + "FROM s2b2c_review r JOIN s2b2c_order o ON o.id = r.order_id "
                        + "JOIN s2b2c_product p ON p.id = r.product_id "
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
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        if (reply == null || reply.isBlank()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写回复内容"));
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.reply FROM s2b2c_review r JOIN s2b2c_order o ON o.id = r.order_id "
                        + "WHERE r.id = ? AND o.channel_id = ?", id, mine.getId());
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该评价不属于当前渠道");
        }
        Object existingReply = rows.get(0).get("reply");
        if (existingReply != null && !String.valueOf(existingReply).isBlank()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该评价已回复"));
        }
        jdbc.update("UPDATE s2b2c_review SET reply = ?, reply_time = NOW(), reply_by = 'CHANNEL' WHERE id = ?",
                reply.trim(), id);
        return ResponseEntity.ok(Map.of("success", true, "message", "回复已提交"));
    }

    /** 本渠道客户：按订单聚合，支持关键字/分层筛选。 */
    @GetMapping("/customers")
    public ResponseEntity<Map<String, Object>> customers(@RequestParam(required = false) String keyword,
                                                         @RequestParam(required = false) String layer,
                                                         @RequestParam(defaultValue = "1") int page,
                                                         @RequestParam(defaultValue = "10") int size) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        List<Map<String, Object>> agg = jdbc.queryForList(
                "SELECT consumer_id, COUNT(*) order_count, IFNULL(SUM(pay_amount),0) total_amount, MAX(create_time) last_order "
                        + "FROM s2b2c_order WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND consumer_id IS NOT NULL "
                        + "GROUP BY consumer_id ORDER BY total_amount DESC", mine.getId());
        List<Map<String, Object>> records = new ArrayList<>();
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        int repeat = 0;
        int highValue = 0;
        int sleeping = 0;
        int newCount = 0;
        int activeCount = 0;
        int overallCount = 0;
        BigDecimal totalSpend = BigDecimal.ZERO;
        for (Map<String, Object> row : agg) {
            Consumer consumer = consumerMapper.selectById(String.valueOf(row.get("consumer_id")));
            if (consumer == null) {
                continue;
            }
            overallCount++;
            long orderCount = ((Number) row.get("order_count")).longValue();
            BigDecimal totalAmount = new BigDecimal(String.valueOf(row.get("total_amount")));
            Object lastValue = row.get("last_order");
            LocalDateTime lastOrder = lastValue == null ? null
                    : (lastValue instanceof java.sql.Timestamp ts ? ts.toLocalDateTime() : (LocalDateTime) lastValue);
            String computedLayer;
            if (lastOrder != null && lastOrder.isBefore(thirtyDaysAgo)) {
                computedLayer = "SLEEPING";
                sleeping++;
            } else if (totalAmount.compareTo(new BigDecimal("500")) >= 0 || orderCount >= 5) {
                computedLayer = "HIGH_VALUE";
                highValue++;
            } else if (orderCount <= 1) {
                computedLayer = "NEW";
                newCount++;
            } else {
                computedLayer = "ACTIVE";
                activeCount++;
            }
            totalSpend = totalSpend.add(totalAmount);
            if (orderCount > 1) {
                repeat++;
            }
            if (layer != null && !layer.isBlank() && !layer.equals(computedLayer)) {
                continue;
            }
            String phone = consumer.getPhone();
            String name = consumer.getNickname() == null || consumer.getNickname().isBlank()
                    ? (phone == null || phone.length() < 4 ? "微信用户" : "客户" + phone.substring(phone.length() - 4))
                    : consumer.getNickname();
            if (keyword != null && !keyword.isBlank()) {
                String kw = keyword.trim();
                if (!name.contains(kw) && (phone == null || !phone.contains(kw))) {
                    continue;
                }
            }
            Map<String, Object> item = new HashMap<>();
            item.put("consumerId", consumer.getId());
            item.put("name", name);
            item.put("phone", maskPhone(phone));
            item.put("memberLevel", consumer.getMemberLevel());
            item.put("orderCount", orderCount);
            item.put("totalAmount", totalAmount);
            item.put("avgAmount", totalAmount.divide(BigDecimal.valueOf(orderCount), 2, RoundingMode.HALF_UP));
            item.put("lastOrderTime", lastOrder);
            item.put("layer", computedLayer);
            records.add(item);
        }
        int from = Math.min(Math.max((page - 1) * size, 0), records.size());
        int to = Math.min(from + size, records.size());
        Map<String, Object> summary = new HashMap<>();
        summary.put("total", overallCount);
        summary.put("repeat", repeat);
        summary.put("highValue", highValue);
        summary.put("sleeping", sleeping);
        summary.put("newCount", newCount);
        summary.put("activeCount", activeCount);
        summary.put("totalSpend", totalSpend);
        summary.put("avgAmount", overallCount == 0 ? BigDecimal.ZERO
                : totalSpend.divide(BigDecimal.valueOf(overallCount), 2, RoundingMode.HALF_UP));
        summary.put("repeatRate", overallCount == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(repeat).multiply(new BigDecimal("100"))
                .divide(BigDecimal.valueOf(overallCount), 2, RoundingMode.HALF_UP));
        Map<String, Object> result = new HashMap<>();
        result.put("records", records.subList(from, to));
        result.put("total", records.size());
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }

    /** 客户画像：本渠道内的消费汇总与最近订单。 */
    @GetMapping("/customer/{consumerId}")
    public ResponseEntity<Map<String, Object>> customerDetail(@PathVariable Long consumerId) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        Consumer consumer = consumerMapper.selectById(consumerId);
        if (consumer == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "客户不存在");
        }
        List<Order> orders = orderMapper.selectList(new LambdaQueryWrapper<Order>()
                .eq(Order::getChannelId, mine.getId())
                .eq(Order::getConsumerId, consumerId)
                .ne(Order::getStatus, "CANCELLED")
                .orderByDesc(Order::getCreateTime));
        if (orders.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该客户没有在本渠道下单");
        }
        BigDecimal total = orders.stream().map(Order::getPayAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> data = new HashMap<>();
        Map<String, Object> profile = new HashMap<>();
        profile.put("consumerId", consumer.getId());
        profile.put("name", consumer.getNickname());
        profile.put("phone", maskPhone(consumer.getPhone()));
        profile.put("memberLevel", consumer.getMemberLevel());
        profile.put("orderCount", orders.size());
        profile.put("totalAmount", total);
        profile.put("avgAmount", total.divide(BigDecimal.valueOf(orders.size()), 2, RoundingMode.HALF_UP));
        profile.put("lastOrderTime", orders.get(0).getCreateTime());
        data.put("profile", profile);
        data.put("orders", orders.stream().limit(10).toList());
        List<Map<String, Object>> topProducts = jdbc.queryForList(
                "SELECT oi.product_id, oi.name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.channel_id = ? AND o.consumer_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') "
                        + "GROUP BY oi.product_id, oi.name ORDER BY amount DESC LIMIT 5", mine.getId(), consumerId);
        data.put("topProducts", topProducts);
        return ResponseEntity.ok(data);
    }

    /**
     * 渠道营销中心（只读）：平台优惠券 + 本店在架商品可参与的秒杀/拼团。
     *
     * <p>活动由平台运营创建，渠道不自行建活动、不改价盘；只展示可用于本店商品的活动与分享链接。</p>
     */
    @GetMapping("/marketing")
    public ResponseEntity<Map<String, Object>> marketing() {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        List<Long> productIds = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                        .eq(ChannelProduct::getChannelId, mine.getId())
                        .eq(ChannelProduct::getStatus, "ACTIVE"))
                .stream().map(ChannelProduct::getProductId).filter(java.util.Objects::nonNull).distinct().toList();
        List<Map<String, Object>> coupons = jdbc.queryForList(
                "SELECT id, name, type, amount, discount_rate AS discountRate, min_amount AS minAmount, "
                        + "remain_count AS remainCount, valid_start AS validStart, valid_end AS validEnd "
                        + "FROM s2b2c_coupon WHERE status = 'ACTIVE' ORDER BY amount DESC, id");
        List<Map<String, Object>> flashes = new ArrayList<>();
        List<Map<String, Object>> groups = new ArrayList<>();
        if (!productIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(productIds.size(), "?"));
            Object[] ids = productIds.toArray();
            flashes = jdbc.queryForList(
                    "SELECT f.id, p.name AS productName, f.sale_price AS salePrice, f.original_price AS originalPrice, "
                            + "f.start_time AS startTime, f.end_time AS endTime, f.remain_stock AS remainStock, "
                            + "f.total_stock AS totalStock, f.status FROM s2b2c_flash_sale f "
                            + "JOIN s2b2c_product p ON f.product_id = p.id "
                            + "WHERE f.product_id IN (" + placeholders + ") AND f.status IN ('ACTIVE','UPCOMING') "
                            + "ORDER BY f.start_time ASC", ids);
            groups = jdbc.queryForList(
                    "SELECT g.id, g.name, p.name AS productName, g.single_price AS singlePrice, "
                            + "g.group_price AS groupPrice, g.group_size AS groupSize, g.valid_hours AS validHours, "
                            + "g.start_time AS startTime, g.end_time AS endTime, g.status FROM s2b2c_group_buy g "
                            + "JOIN s2b2c_product p ON g.product_id = p.id "
                            + "WHERE g.product_id IN (" + placeholders + ") AND g.status IN ('ACTIVE','UPCOMING') "
                            + "ORDER BY g.start_time ASC", ids);
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("coupons", coupons.size());
        summary.put("flashes", flashes.size());
        summary.put("groups", groups.size());
        summary.put("shelfProducts", productIds.size());
        Map<String, Object> result = new HashMap<>();
        result.put("channelId", String.valueOf(mine.getId()));
        result.put("shopName", mine.getShopName());
        result.put("summary", summary);
        result.put("coupons", coupons);
        result.put("flashes", flashes);
        result.put("groups", groups);
        result.put("storeSharePath", "/pages/channel/index?channelId=" + mine.getId());
        return ResponseEntity.ok(result);
    }

    /** 渠道库存视图：本渠道在架商品库存、本渠道 7 日动销与可售天数（只读）。 */
    @GetMapping("/inventory")
    public ResponseEntity<Map<String, Object>> inventory() {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        List<ChannelProduct> relations = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getChannelId, mine.getId())
                .eq(ChannelProduct::getStatus, "ACTIVE"));
        Map<Long, Long> sales7 = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT oi.product_id, SUM(oi.quantity) qty FROM s2b2c_order_item oi "
                        + "JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.channel_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY oi.product_id", mine.getId(), LocalDate.now().minusDays(6).atStartOfDay())) {
            sales7.put(((Number) row.get("product_id")).longValue(), ((Number) row.get("qty")).longValue());
        }
        List<Map<String, Object>> records = new ArrayList<>();
        int lowCount = 0;
        int outCount = 0;
        long totalStock = 0;
        for (ChannelProduct relation : relations) {
            com.agri.s2b2c.entity.Product product = productMapper.selectById(relation.getProductId());
            if (product == null || !"APPROVED".equals(product.getStatus())) {
                continue;
            }
            long stock = product.getStock() == null ? 0 : product.getStock();
            long sold = sales7.getOrDefault(product.getId(), 0L);
            BigDecimal effective = relation.getRetailPrice() != null && relation.getRetailPrice().signum() > 0
                    ? relation.getRetailPrice() : product.getPrice();
            BigDecimal days = sold == 0 ? null
                    : BigDecimal.valueOf(stock).multiply(new BigDecimal("7"))
                    .divide(BigDecimal.valueOf(sold), 1, RoundingMode.HALF_UP);
            String status;
            if (stock <= 0) {
                status = "OUT";
                outCount++;
            } else if (sold > 0 && days.compareTo(new BigDecimal("7")) < 0) {
                status = "LOW";
                lowCount++;
            } else {
                status = "NORMAL";
            }
            totalStock += stock;
            Map<String, Object> item = new HashMap<>();
            item.put("productId", product.getId());
            item.put("name", product.getName());
            item.put("unit", product.getUnit());
            item.put("stock", stock);
            item.put("sales7", sold);
            item.put("daysOfSupply", days);
            item.put("retailPrice", relation.getRetailPrice());
            item.put("effectivePrice", effective);
            item.put("shelfStatus", relation.getShelfStatus() == null ? "ON" : relation.getShelfStatus());
            item.put("stockStatus", status);
            records.add(item);
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("skuCount", records.size());
        summary.put("totalStock", totalStock);
        summary.put("lowCount", lowCount);
        summary.put("outCount", outCount);
        Map<String, Object> result = new HashMap<>();
        result.put("records", records);
        result.put("summary", summary);
        return ResponseEntity.ok(result);
    }

    /** 经营分析：区间汇总、按日走势、商品排行、状态分布。 */
    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> analytics(@RequestParam(defaultValue = "30") int days) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        int range = Math.min(Math.max(days, 7), 365);
        LocalDate start = LocalDate.now().minusDays(range - 1L);
        Map<String, Object> totals = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) sales FROM s2b2c_order "
                        + "WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ?",
                mine.getId(), start.atStartOfDay());
        long orders = ((Number) totals.get("orders")).longValue();
        BigDecimal sales = new BigDecimal(String.valueOf(totals.get("sales")));
        Map<String, Object> commission = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END),0) settled, "
                        + "IFNULL(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END),0) pending "
                        + "FROM s2b2c_commission WHERE channel_id = ? AND create_time >= ?",
                mine.getId(), start.atStartOfDay());

        Map<String, BigDecimal> amountByDay = new LinkedHashMap<>();
        Map<String, Long> countByDay = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT DATE(create_time) d, IFNULL(SUM(pay_amount),0) amount, COUNT(*) cnt FROM s2b2c_order "
                        + "WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? "
                        + "GROUP BY DATE(create_time) ORDER BY DATE(create_time)",
                mine.getId(), start.atStartOfDay())) {
            String key = String.valueOf(row.get("d"));
            amountByDay.put(key, new BigDecimal(String.valueOf(row.get("amount"))));
            countByDay.put(key, ((Number) row.get("cnt")).longValue());
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 0; i < range; i++) {
            LocalDate day = start.plusDays(i);
            String key = day.toString();
            Map<String, Object> point = new HashMap<>();
            point.put("date", day.format(DATE_LABEL));
            point.put("amount", amountByDay.getOrDefault(key, BigDecimal.ZERO));
            point.put("orders", countByDay.getOrDefault(key, 0L));
            trend.add(point);
        }

        List<Map<String, Object>> topProducts = jdbc.queryForList(
                "SELECT oi.product_id, oi.name, SUM(oi.quantity) qty, SUM(oi.total_amount) amount "
                        + "FROM s2b2c_order_item oi JOIN s2b2c_order o ON oi.order_id = o.id "
                        + "WHERE o.channel_id = ? AND o.status NOT IN ('CANCELLED','REFUNDED') AND o.create_time >= ? "
                        + "GROUP BY oi.product_id, oi.name ORDER BY amount DESC LIMIT 5",
                mine.getId(), start.atStartOfDay());

        Map<String, Object> byStatus = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT status, COUNT(*) cnt FROM s2b2c_order WHERE channel_id = ? GROUP BY status", mine.getId())) {
            byStatus.put(String.valueOf(row.get("status")), row.get("cnt"));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("days", range);
        result.put("sales", sales);
        result.put("orders", orders);
        result.put("avgOrderAmount", orders == 0 ? BigDecimal.ZERO
                : sales.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP));
        result.put("commissionSettled", commission.get("settled"));
        result.put("commissionPending", commission.get("pending"));
        result.put("trend", trend);
        result.put("topProducts", topProducts);
        result.put("byStatus", byStatus);
        return ResponseEntity.ok(result);
    }

    /** 分润对账：按月汇总 + 流水（佣金与提现）。 */
    @GetMapping("/reconcile")
    public ResponseEntity<Map<String, Object>> reconcile(@RequestParam(required = false) String month) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        YearMonth period;
        try {
            period = month == null || month.isBlank() ? YearMonth.now() : YearMonth.parse(month);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "账期格式应为 YYYY-MM"));
        }
        LocalDateTime start = period.atDay(1).atStartOfDay();
        LocalDateTime end = period.plusMonths(1).atDay(1).atStartOfDay();

        Map<String, Object> gmv = jdbc.queryForMap(
                "SELECT COUNT(*) orders, IFNULL(SUM(pay_amount),0) amount FROM s2b2c_order "
                        + "WHERE channel_id = ? AND status NOT IN ('CANCELLED','REFUNDED') AND create_time >= ? AND create_time < ?",
                mine.getId(), start, end);
        Map<String, Object> commission = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END),0) settled, "
                        + "IFNULL(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END),0) pending "
                        + "FROM s2b2c_commission WHERE channel_id = ? AND create_time >= ? AND create_time < ?",
                mine.getId(), start, end);
        Map<String, Object> withdrawal = jdbc.queryForMap(
                "SELECT IFNULL(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END),0) paid, "
                        + "IFNULL(SUM(CASE WHEN status IN ('PENDING','APPROVED') THEN amount ELSE 0 END),0) processing, "
                        + "COUNT(*) cnt FROM s2b2c_commission_withdrawal "
                        + "WHERE channel_id = ? AND apply_time >= ? AND apply_time < ?",
                mine.getId(), start, end);

        List<Map<String, Object>> ledger = jdbc.queryForList(
                "SELECT c.create_time t, 'COMMISSION' type, c.id ref, o.order_no ref_no, "
                        + "CONCAT('订单佣金 ', IFNULL(c.rate,0), '%') summary, c.amount amount, c.status status "
                        + "FROM s2b2c_commission c LEFT JOIN s2b2c_order o ON c.order_id = o.id "
                        + "WHERE c.channel_id = ? AND c.create_time >= ? AND c.create_time < ? "
                        + "UNION ALL "
                        + "SELECT w.apply_time, 'WITHDRAWAL', w.id, NULL, '提现申请', -w.amount, w.status "
                        + "FROM s2b2c_commission_withdrawal w "
                        + "WHERE w.channel_id = ? AND w.apply_time >= ? AND w.apply_time < ? "
                        + "ORDER BY t DESC",
                mine.getId(), start, end, mine.getId(), start, end);
        List<Map<String, Object>> batches = jdbc.queryForList(
                "SELECT batch_no, commission_count, amount, operator, created_at FROM s2b2c_commission_settlement "
                        + "WHERE channel_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC",
                mine.getId(), start, end);

        Map<String, Object> summary = new HashMap<>();
        summary.put("gmv", gmv.get("amount"));
        summary.put("orderCount", gmv.get("orders"));
        summary.put("commissionSettled", commission.get("settled"));
        summary.put("commissionPending", commission.get("pending"));
        summary.put("withdrawalPaid", withdrawal.get("paid"));
        summary.put("withdrawalProcessing", withdrawal.get("processing"));
        summary.put("netIncome", new BigDecimal(String.valueOf(commission.get("settled")))
                .subtract(new BigDecimal(String.valueOf(withdrawal.get("paid")))));

        Map<String, Object> result = new HashMap<>();
        result.put("month", period.toString());
        result.put("summary", summary);
        result.put("ledger", ledger);
        result.put("settlements", batches);
        return ResponseEntity.ok(result);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
