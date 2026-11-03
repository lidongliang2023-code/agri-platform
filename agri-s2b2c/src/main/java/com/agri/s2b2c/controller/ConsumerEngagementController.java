package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.service.ConsumerIdentityService;
import com.agri.s2b2c.service.OrderCancellationService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 消费者域的"内容/关系/成长"类接口：分类树、溯源码查询、物流、取消订单、
 * 消息中心、收藏、足迹、评价、签到积分、会员成长。
 *
 * <p>与 {@link ExperienceController} 同风格：直接 JdbcTemplate 读写，返回值用
 * LinkedHashMap 拼装（字段顺序即前端展示顺序），归属校验统一走
 * {@link ConsumerIdentityService#requireSelf(Long)} / {@code requireOwnOrder}。</p>
 *
 * <p>路径不放在类级 @RequestMapping 上：这里混着 /api/consumer/** 的多个语义分组，
 * 逐方法写全路径更利于和前端契约一一对照，也避免与 ConsumerController 的前缀重复。</p>
 */
@RestController
public class ConsumerEngagementController {

    private static final int SIGN_IN_POINTS = 5;

    private final JdbcTemplate jdbc;
    private final ConsumerIdentityService consumerIdentityService;
    private final ObjectMapper objectMapper;
    private final OrderCancellationService orderCancellationService;

    public ConsumerEngagementController(JdbcTemplate jdbc, ConsumerIdentityService consumerIdentityService,
                                        ObjectMapper objectMapper,
                                        OrderCancellationService orderCancellationService) {
        this.jdbc = jdbc;
        this.consumerIdentityService = consumerIdentityService;
        this.objectMapper = objectMapper;
        this.orderCancellationService = orderCancellationService;
    }

    // ── 分类 ────────────────────────────────────────────────────────────

    /** 分类树：sort_order 升序，parentId=0（或找不到父节点）的作为一级。 */
    @GetMapping("/api/consumer/categories")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> categories() {
        List<Map<String, Object>> flat = jdbc.query("""
                SELECT id,parent_id,name,icon,level FROM s2b2c_category
                ORDER BY sort_order,id
                """, (rs, rowNum) -> {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", rs.getLong("id"));
            node.put("parentId", rs.getLong("parent_id"));
            node.put("name", rs.getString("name"));
            node.put("icon", rs.getString("icon"));
            node.put("level", rs.getInt("level"));
            node.put("children", new ArrayList<Map<String, Object>>());
            return node;
        });
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> node : flat) {
            byId.put(Long.valueOf(String.valueOf(node.get("id"))), node);
        }
        List<Map<String, Object>> roots = new ArrayList<>();
        for (Map<String, Object> node : flat) {
            Long parentId = Long.valueOf(String.valueOf(node.get("parentId")));
            Map<String, Object> parent = parentId == null || parentId == 0L ? null : byId.get(parentId);
            if (parent == null) {
                roots.add(node);
            } else {
                childrenOf(parent).add(node);
            }
        }
        return ResponseEntity.ok(roots);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> childrenOf(Map<String, Object> node) {
        return (List<Map<String, Object>>) node.get("children");
    }

    // ── 溯源（按批次码） ────────────────────────────────────────────────

    /** 消费者扫商品包装上的批次码查询溯源；查不到给 404，前端据此提示"非本平台商品"。 */
    @GetMapping("/api/consumer/trace/code/{code}")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Object> traceByCode(@PathVariable String code) {
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT t.id,t.batch_code AS batchCode,t.origin,t.planting_date AS plantingDate,
                       t.harvest_date AS harvestDate,t.processing_info AS processingInfo,
                       t.quality_report AS qualityReport,t.storage_info AS storageInfo,
                       t.product_id AS productId,p.name AS productName
                FROM s2b2c_traceability t LEFT JOIN s2b2c_product p ON p.id=t.product_id
                WHERE t.batch_code=? LIMIT 1
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "batchCode", rs.getString("batchCode"),
                "origin", rs.getString("origin"), "plantingDate", rs.getString("plantingDate"),
                "harvestDate", rs.getString("harvestDate"), "processingInfo", rs.getString("processingInfo"),
                "qualityReport", rs.getString("qualityReport"), "storageInfo", rs.getString("storageInfo"),
                "productId", rs.getLong("productId"), "productName", rs.getString("productName")), code);
        if (rows.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "未查询到该溯源码对应的批次"));
        }
        return ResponseEntity.ok(rows);
    }

    // ── 物流 ────────────────────────────────────────────────────────────

    @GetMapping("/api/consumer/logistics/{orderId}")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Object> logistics(@PathVariable Long orderId) {
        consumerIdentityService.requireOwnOrder(orderId);
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT order_id AS orderId,logistics_no AS logisticsNo,logistics_company AS logisticsCompany,
                       tracking_info AS trackingInfo,status,create_time AS createTime,update_time AS updateTime
                FROM s2b2c_logistics WHERE order_id=?
                ORDER BY create_time DESC,id DESC LIMIT 1
                """, (rs, rowNum) -> row(
                "orderId", rs.getLong("orderId"), "logisticsNo", rs.getString("logisticsNo"),
                "logisticsCompany", rs.getString("logisticsCompany"), "trackingInfo", rs.getString("trackingInfo"),
                "status", rs.getString("status"), "createTime", rs.getString("createTime"),
                "updateTime", rs.getString("updateTime")), orderId);
        if (rows.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "该订单还没有物流信息"));
        }
        Map<String, Object> data = rows.get(0);
        String orderStatus = jdbc.queryForObject("SELECT status FROM s2b2c_order WHERE id=?", String.class, orderId);
        data.put("orderStatus", orderStatus);
        return ResponseEntity.ok(data);
    }

    // ── 取消订单 ────────────────────────────────────────────────────────

    /** 只允许取消待付款订单：状态由 SQL 条件兜住，避免并发下把已付款订单改成取消。 */
    @PutMapping("/api/consumer/order/cancel/{id}")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> cancelOrder(@PathVariable Long id) {
        consumerIdentityService.requireOwnOrder(id);
        if (!orderCancellationService.cancel(id)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "只有待付款订单可以取消"));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "订单已取消"));
    }

    // ── 消息中心 ────────────────────────────────────────────────────────

    @GetMapping("/api/consumer/messages")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> messages(@RequestParam Long consumerId,
                                                              @RequestParam(required = false) String type) {
        consumerIdentityService.requireSelf(consumerId);
        String sql = """
                SELECT id,type,title,content,is_read AS isRead,create_time AS createTime
                FROM s2b2c_message WHERE receiver_type='CONSUMER' AND receiver_id=?
                """ + (hasText(type) ? " AND type=?" : "") + " ORDER BY create_time DESC LIMIT 100";
        Object[] args = hasText(type) ? new Object[]{consumerId, type} : new Object[]{consumerId};
        return ResponseEntity.ok(jdbc.query(sql, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "type", rs.getString("type"), "title", rs.getString("title"),
                "content", rs.getString("content"), "isRead", rs.getBoolean("isRead"),
                "createTime", rs.getString("createTime")), args));
    }

    @PutMapping("/api/consumer/messages/{id}/read")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> readMessage(@PathVariable Long id) {
        Long consumerId = consumerIdentityService.current().getId();
        Integer owned = jdbc.queryForObject("""
                SELECT COUNT(*) FROM s2b2c_message WHERE id=? AND receiver_type='CONSUMER' AND receiver_id=?
                """, Integer.class, id, consumerId);
        if (owned == null || owned == 0) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "无权操作该消息"));
        }
        int updated = jdbc.update("UPDATE s2b2c_message SET is_read=1 WHERE id=?", id);
        return ResponseEntity.ok(Map.of("success", updated > 0));
    }

    @PutMapping("/api/consumer/messages/read-all")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> readAllMessages(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        int updated = jdbc.update("""
                UPDATE s2b2c_message SET is_read=1 WHERE receiver_type='CONSUMER' AND receiver_id=? AND is_read=0
                """, consumerId);
        return ResponseEntity.ok(Map.of("success", true, "updated", updated));
    }

    // ── 收藏 ────────────────────────────────────────────────────────────

    @GetMapping("/api/consumer/favorites")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> favorites(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        return ResponseEntity.ok(jdbc.query("""
                SELECT f.id,f.product_id AS productId,p.name,p.price,p.origin,p.images,p.status,p.stock,
                       f.create_time AS createTime
                FROM s2b2c_favorite f LEFT JOIN s2b2c_product p ON p.id=f.product_id
                WHERE f.consumer_id=? ORDER BY f.create_time DESC
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "productId", rs.getLong("productId"), "name", rs.getString("name"),
                "price", rs.getBigDecimal("price"), "origin", rs.getString("origin"),
                "image", firstImage(rs.getString("images")), "status", rs.getString("status"),
                "stock", rs.getInt("stock"), "createTime", rs.getString("createTime")), consumerId));
    }

    /** 幂等收藏：重复收藏不报错，直接回"已在收藏夹中"。 */
    @PostMapping("/api/consumer/favorites")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> addFavorite(@RequestParam Long consumerId,
                                                           @RequestParam Long productId) {
        consumerIdentityService.requireSelf(consumerId);
        Integer products = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_product WHERE id=?",
                Integer.class, productId);
        if (products == null || products == 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不存在"));
        }
        Integer owned = jdbc.queryForObject("""
                SELECT COUNT(*) FROM s2b2c_favorite WHERE consumer_id=? AND product_id=?
                """, Integer.class, consumerId, productId);
        if (owned != null && owned > 0) {
            return ResponseEntity.ok(Map.of("success", true, "message", "已在收藏夹中"));
        }
        try {
            jdbc.update("""
                    INSERT INTO s2b2c_favorite (id,consumer_id,product_id,create_time) VALUES (?,?,?,?)
                    """, System.currentTimeMillis(), consumerId, productId, LocalDateTime.now());
        } catch (DuplicateKeyException ignored) {
            // 并发重复提交被唯一键挡住，语义上仍算收藏成功
            return ResponseEntity.ok(Map.of("success", true, "message", "已在收藏夹中"));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "收藏成功"));
    }

    @DeleteMapping("/api/consumer/favorites")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> removeFavorite(@RequestParam Long consumerId,
                                                              @RequestParam Long productId) {
        consumerIdentityService.requireSelf(consumerId);
        int deleted = jdbc.update("DELETE FROM s2b2c_favorite WHERE consumer_id=? AND product_id=?",
                consumerId, productId);
        return ResponseEntity.ok(Map.of("success", true, "message", deleted > 0 ? "已取消收藏" : "该商品不在收藏夹中"));
    }

    // ── 足迹 ────────────────────────────────────────────────────────────

    @GetMapping("/api/consumer/footprints")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> footprints(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        return ResponseEntity.ok(jdbc.query("""
                SELECT fp.id,fp.product_id AS productId,p.name,p.price,p.origin,p.images,p.status,p.stock,
                       fp.create_time AS createTime,fp.update_time AS visitedAt
                FROM s2b2c_footprint fp LEFT JOIN s2b2c_product p ON p.id=fp.product_id
                WHERE fp.consumer_id=? ORDER BY fp.update_time DESC LIMIT 60
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "productId", rs.getLong("productId"), "name", rs.getString("name"),
                "price", rs.getBigDecimal("price"), "origin", rs.getString("origin"),
                "image", firstImage(rs.getString("images")), "status", rs.getString("status"),
                "stock", rs.getInt("stock"), "createTime", rs.getString("createTime"),
                "visitedAt", rs.getString("visitedAt")), consumerId));
    }

    /** 同一消费者同商品只保留一行，重复访问只刷新 update_time（"最近看过"排序依据）。 */
    @PostMapping("/api/consumer/footprints")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> addFootprint(@RequestParam Long consumerId,
                                                            @RequestParam Long productId) {
        consumerIdentityService.requireSelf(consumerId);
        LocalDateTime now = LocalDateTime.now();
        int updated = jdbc.update("""
                UPDATE s2b2c_footprint SET update_time=? WHERE consumer_id=? AND product_id=?
                """, now, consumerId, productId);
        if (updated == 0) {
            try {
                jdbc.update("""
                        INSERT INTO s2b2c_footprint (id,consumer_id,product_id,create_time,update_time)
                        VALUES (?,?,?,?,?)
                        """, System.currentTimeMillis(), consumerId, productId, now, now);
            } catch (DuplicateKeyException ignored) {
                // 并发插入撞唯一键，退化为刷新时间
                jdbc.update("""
                        UPDATE s2b2c_footprint SET update_time=? WHERE consumer_id=? AND product_id=?
                        """, now, consumerId, productId);
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "已记录浏览"));
    }

    @DeleteMapping("/api/consumer/footprints")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> clearFootprints(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        int deleted = jdbc.update("DELETE FROM s2b2c_footprint WHERE consumer_id=?", consumerId);
        return ResponseEntity.ok(Map.of("success", true, "deleted", deleted));
    }

    // ── 评价 ────────────────────────────────────────────────────────────

    @GetMapping("/api/consumer/reviews")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> productReviews(@RequestParam Long productId,
                                                              @RequestParam(defaultValue = "1") int page,
                                                              @RequestParam(defaultValue = "10") int size) {
        int safePage = Math.max(page, 1);
        int safeSize = clampSize(size, 10, 50);
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_review WHERE product_id=? AND hidden=0",
                Integer.class, productId);
        List<Map<String, Object>> records = jdbc.query("""
                SELECT r.id,r.product_id AS productId,r.rating,r.content,r.tags,r.images,r.anonymous,
                       r.reply,r.reply_time AS replyTime,r.reply_by AS replyBy,r.create_time AS createTime,c.nickname
                FROM s2b2c_review r LEFT JOIN s2b2c_consumer c ON c.id=r.consumer_id
                WHERE r.product_id=? AND r.hidden=0 ORDER BY r.create_time DESC,r.id DESC LIMIT ? OFFSET ?
                """, (rs, rowNum) -> {
            boolean anonymous = rs.getBoolean("anonymous");
            return row(
                    "id", rs.getLong("id"), "productId", rs.getLong("productId"), "rating", rs.getInt("rating"),
                    "content", rs.getString("content"), "tags", rs.getString("tags"),
                    "images", rs.getString("images"), "anonymous", anonymous,
                    // 匿名评价不回传昵称，前端统一显示"匿名用户"
                    "nickname", anonymous ? null : rs.getString("nickname"),
                    "reply", rs.getString("reply"), "replyTime", rs.getString("replyTime"),
                    "replyBy", rs.getString("replyBy"), "createTime", rs.getString("createTime"));
        }, productId, safeSize, (long) (safePage - 1) * safeSize);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("records", records);
        data.put("total", total == null ? 0 : total);
        return ResponseEntity.ok(data);
    }

    @GetMapping("/api/consumer/reviews/summary/{productId}")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> reviewSummary(@PathVariable Long productId) {
        Map<String, Object> agg = jdbc.queryForMap("""
                SELECT COUNT(*) AS total,AVG(rating) AS average FROM s2b2c_review WHERE product_id=? AND hidden=0
                """, productId);
        long total = ((Number) agg.getOrDefault("total", 0)).longValue();
        Object avgRaw = agg.get("average");
        BigDecimal average = avgRaw instanceof Number n && total > 0
                ? BigDecimal.valueOf(n.doubleValue()).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
        Map<Integer, Long> counts = new LinkedHashMap<>();
        jdbc.query("SELECT rating,COUNT(*) AS c FROM s2b2c_review WHERE product_id=? AND hidden=0 GROUP BY rating",
                rs -> {
                    counts.put(rs.getInt("rating"), rs.getLong("c"));
                }, productId);
        List<Map<String, Object>> distribution = new ArrayList<>();
        for (int star = 5; star >= 1; star--) {
            distribution.add(row("star", star, "count", counts.getOrDefault(star, 0L)));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", total);
        data.put("average", average);
        data.put("distribution", distribution);
        return ResponseEntity.ok(data);
    }

    @GetMapping("/api/consumer/reviews/mine")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> myReviews(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        return ResponseEntity.ok(jdbc.query("""
                SELECT r.id,r.order_id AS orderId,r.order_item_id AS orderItemId,r.product_id AS productId,
                       p.name AS productName,r.rating,r.content,r.tags,r.images,r.anonymous,
                       r.reply,r.reply_time AS replyTime,r.reply_by AS replyBy,r.hidden,r.create_time AS createTime
                FROM s2b2c_review r LEFT JOIN s2b2c_product p ON p.id=r.product_id
                WHERE r.consumer_id=? ORDER BY r.create_time DESC,r.id DESC
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "orderId", rs.getLong("orderId"),
                "orderItemId", rs.getObject("orderItemId", Long.class), "productId", rs.getLong("productId"),
                "productName", rs.getString("productName"), "rating", rs.getInt("rating"),
                "content", rs.getString("content"), "tags", rs.getString("tags"),
                "images", rs.getString("images"), "anonymous", rs.getBoolean("anonymous"),
                "reply", rs.getString("reply"), "replyTime", rs.getString("replyTime"),
                "replyBy", rs.getString("replyBy"), "hidden", rs.getBoolean("hidden"),
                "createTime", rs.getString("createTime")), consumerId));
    }

    @PostMapping("/api/consumer/reviews")
    @OperatorOnly("s2b2c:consumer")
    @Transactional
    public ResponseEntity<Map<String, Object>> createReview(@RequestBody Map<String, Object> body) {
        Long consumerId = longValue(body.get("consumerId"));
        Long orderId = longValue(body.get("orderId"));
        Long orderItemId = longValue(body.get("orderItemId"));
        Long productId = longValue(body.get("productId"));
        Integer rating = intValue(body.get("rating"));
        consumerIdentityService.requireSelf(consumerId);
        if (consumerId == null || orderId == null || productId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "缺少订单或商品参数"));
        }
        List<Map<String, Object>> orders = jdbc.queryForList(
                "SELECT status FROM s2b2c_order WHERE id = ? AND consumer_id = ?", orderId, consumerId);
        if (orders.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "订单不存在或不属于当前消费者"));
        }
        if (!"COMPLETED".equalsIgnoreCase(String.valueOf(orders.get(0).get("status")))) {
            return ResponseEntity.ok(Map.of("success", false, "message", "订单完成后才能评价"));
        }
        Integer itemCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_order_item WHERE order_id = ? AND product_id = ?",
                Integer.class, orderId, productId);
        if (itemCount == null || itemCount == 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不属于该订单"));
        }
        if (rating == null || rating < 1 || rating > 5) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "评分必须是 1-5"));
        }
        Integer existed = jdbc.queryForObject("""
                SELECT COUNT(*) FROM s2b2c_review WHERE consumer_id=? AND order_id=? AND product_id=?
                """, Integer.class, consumerId, orderId, productId);
        if (existed != null && existed > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该订单商品已评价"));
        }
        long id = System.currentTimeMillis();
        try {
            jdbc.update("""
                    INSERT INTO s2b2c_review
                    (id,order_id,order_item_id,product_id,consumer_id,rating,content,tags,images,anonymous,create_time)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                    """, id, orderId, orderItemId, productId, consumerId, rating,
                    text(body.get("content"), null), tagsText(body.get("tags")), imagesText(body.get("images")),
                    boolValue(body.get("anonymous")), LocalDateTime.now());
        } catch (DuplicateKeyException ignored) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该订单商品已评价"));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "评价已提交", "id", id));
    }

    // ── 签到 / 积分 ─────────────────────────────────────────────────────

    @GetMapping("/api/consumer/signin")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> signInState(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        LocalDate today = LocalDate.now();
        Set<LocalDate> signed = new LinkedHashSet<>(jdbc.query("""
                SELECT sign_date FROM s2b2c_sign_in WHERE consumer_id=? ORDER BY sign_date DESC
                """, (rs, rowNum) -> rs.getDate("sign_date").toLocalDate(), consumerId));
        boolean signedToday = signed.contains(today);
        // 连续天数从今天（没签则从昨天）往前推，断签即停
        LocalDate cursor = signedToday ? today : today.minusDays(1);
        int continuousDays = 0;
        while (signed.contains(cursor)) {
            continuousDays++;
            cursor = cursor.minusDays(1);
        }
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        List<String> monthDates = new ArrayList<>();
        for (LocalDate date : signed) {
            if (!date.isBefore(monthStart) && !date.isAfter(monthEnd)) {
                monthDates.add(date.toString());
            }
        }
        monthDates.sort(String::compareTo);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("signedToday", signedToday);
        data.put("continuousDays", continuousDays);
        data.put("monthDates", monthDates);
        data.put("points", pointsOf(consumerId));
        data.put("todayPoints", SIGN_IN_POINTS);
        return ResponseEntity.ok(data);
    }

    @PostMapping("/api/consumer/signin")
    @OperatorOnly("s2b2c:consumer")
    @Transactional
    public ResponseEntity<Map<String, Object>> signIn(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        LocalDate today = LocalDate.now();
        Integer signedToday = jdbc.queryForObject("""
                SELECT COUNT(*) FROM s2b2c_sign_in WHERE consumer_id=? AND sign_date=?
                """, Integer.class, consumerId, today);
        if (signedToday != null && signedToday > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "今天已经签到过了"));
        }
        try {
            jdbc.update("""
                    INSERT INTO s2b2c_sign_in (id,consumer_id,sign_date,points,create_time) VALUES (?,?,?,?,?)
                    """, System.currentTimeMillis(), consumerId, today, SIGN_IN_POINTS, LocalDateTime.now());
        } catch (DuplicateKeyException ignored) {
            // 并发重复签到由唯一键兜住
            return ResponseEntity.ok(Map.of("success", false, "message", "今天已经签到过了"));
        }
        jdbc.update("UPDATE s2b2c_consumer SET points=points+?,update_time=? WHERE id=?",
                SIGN_IN_POINTS, LocalDateTime.now(), consumerId);
        int balance = pointsOf(consumerId);
        jdbc.update("""
                INSERT INTO s2b2c_points_log (id,consumer_id,type,reason,points,balance,create_time)
                VALUES (?,?,?,?,?,?,?)
                """, System.currentTimeMillis(), consumerId, "SIGN_IN", "每日签到",
                SIGN_IN_POINTS, balance, LocalDateTime.now());
        return ResponseEntity.ok(Map.of("success", true, "points", SIGN_IN_POINTS, "balance", balance,
                "message", "签到成功，积分 +" + SIGN_IN_POINTS));
    }

    @GetMapping("/api/consumer/points/logs")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> pointsLogs(@RequestParam Long consumerId,
                                                          @RequestParam(required = false) String type,
                                                          @RequestParam(defaultValue = "1") int page,
                                                          @RequestParam(defaultValue = "20") int size) {
        consumerIdentityService.requireSelf(consumerId);
        int safePage = Math.max(page, 1);
        int safeSize = clampSize(size, 20, 100);
        String where = " WHERE consumer_id=?" + (hasText(type) ? " AND type=?" : "");
        Object[] countArgs = hasText(type) ? new Object[]{consumerId, type} : new Object[]{consumerId};
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_points_log" + where,
                Integer.class, countArgs);
        Object[] listArgs = hasText(type)
                ? new Object[]{consumerId, type, safeSize, (long) (safePage - 1) * safeSize}
                : new Object[]{consumerId, safeSize, (long) (safePage - 1) * safeSize};
        List<Map<String, Object>> records = jdbc.query("""
                SELECT id,type,reason,points,balance,create_time AS createTime
                FROM s2b2c_points_log""" + where + " ORDER BY create_time DESC,id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "type", rs.getString("type"), "reason", rs.getString("reason"),
                        "points", rs.getInt("points"), "balance", rs.getInt("balance"),
                        "createTime", rs.getString("createTime")), listArgs);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("records", records);
        data.put("total", total == null ? 0 : total);
        return ResponseEntity.ok(data);
    }

    /** 积分商城目录：用在售优惠券当"商品"，兑换后直接发券（复用 coupon_user 领取方式）。 */
    @GetMapping("/api/consumer/points/goods")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> pointsGoods() {
        return ResponseEntity.ok(jdbc.query("""
                SELECT id,name,type,amount,min_amount AS minAmount,valid_end AS validEnd,
                       remain_count AS remainCount
                FROM s2b2c_coupon WHERE status='ACTIVE' AND remain_count>0
                  AND valid_start <= CURDATE() AND valid_end >= CURDATE()
                  AND (budget IS NULL OR budget_used < budget) ORDER BY amount DESC,id
                """, (rs, rowNum) -> {
            BigDecimal amount = rs.getBigDecimal("amount");
            BigDecimal minAmount = rs.getBigDecimal("minAmount");
            String type = rs.getString("type");
            return row(
                    "couponId", rs.getLong("id"), "name", rs.getString("name"), "type", type,
                    "amount", amount, "minAmount", minAmount, "validEnd", rs.getString("validEnd"),
                    "pointsCost", pointsCost(type, amount, minAmount),
                    "remainCount", rs.getInt("remainCount"));
        }));
    }

    @PostMapping("/api/consumer/points/exchange")
    @OperatorOnly("s2b2c:consumer")
    @Transactional
    public ResponseEntity<Map<String, Object>> exchangePoints(@RequestParam Long consumerId,
                                                              @RequestParam Long couponId) {
        consumerIdentityService.requireSelf(consumerId);
        List<Map<String, Object>> coupons = jdbc.query("""
                SELECT id,name,type,amount,min_amount AS minAmount,status,remain_count AS remainCount,
                       budget,budget_used AS budgetUsed
                FROM s2b2c_coupon WHERE id=?
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "name", rs.getString("name"), "type", rs.getString("type"),
                "amount", rs.getBigDecimal("amount"), "minAmount", rs.getBigDecimal("minAmount"),
                "status", rs.getString("status"), "remainCount", rs.getInt("remainCount"),
                "budget", rs.getBigDecimal("budget"), "budgetUsed", rs.getBigDecimal("budgetUsed")), couponId);
        if (coupons.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "优惠券不存在"));
        }
        Map<String, Object> coupon = coupons.get(0);
        if (!"ACTIVE".equals(coupon.get("status")) || ((Number) coupon.get("remainCount")).intValue() <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "优惠券已领完或已失效"));
        }
        BigDecimal budget = (BigDecimal) coupon.get("budget");
        BigDecimal budgetUsed = coupon.get("budgetUsed") == null
                ? BigDecimal.ZERO : (BigDecimal) coupon.get("budgetUsed");
        if (budget != null && budgetUsed.compareTo(budget) >= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "优惠券活动预算已用完"));
        }
        Integer owned = jdbc.queryForObject("""
                SELECT COUNT(*) FROM s2b2c_coupon_user WHERE coupon_id=? AND consumer_id=?
                """, Integer.class, couponId, consumerId);
        if (owned != null && owned > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该优惠券已领取"));
        }
        int cost = pointsCost(String.valueOf(coupon.get("type")),
                (BigDecimal) coupon.get("amount"), (BigDecimal) coupon.get("minAmount"));
        int balance = pointsOf(consumerId);
        if (balance < cost) {
            return ResponseEntity.ok(Map.of("success", false, "message", "积分不足"));
        }
        int stock = jdbc.update("""
                UPDATE s2b2c_coupon SET remain_count=remain_count-1
                WHERE id=? AND status='ACTIVE' AND remain_count>0
                  AND valid_start <= CURDATE() AND valid_end >= CURDATE()
                  AND (budget IS NULL OR budget_used < budget)
                """, couponId);
        if (stock == 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "优惠券已领完或已失效"));
        }
        jdbc.update("""
                INSERT INTO s2b2c_coupon_user (id,coupon_id,consumer_id,status,receive_time)
                VALUES (?,?,?,'UNUSED',?)
                """, System.currentTimeMillis(), couponId, consumerId, LocalDateTime.now());
        jdbc.update("UPDATE s2b2c_consumer SET points=points-?,update_time=? WHERE id=?",
                cost, LocalDateTime.now(), consumerId);
        int newBalance = balance - cost;
        jdbc.update("""
                INSERT INTO s2b2c_points_log (id,consumer_id,type,reason,points,balance,create_time)
                VALUES (?,?,?,?,?,?,?)
                """, System.currentTimeMillis(), consumerId, "EXCHANGE", "积分兑换：" + coupon.get("name"),
                -cost, newBalance, LocalDateTime.now());
        return ResponseEntity.ok(Map.of("success", true, "message", "兑换成功", "points", cost, "balance", newBalance));
    }

    // ── 会员成长 ────────────────────────────────────────────────────────

    @GetMapping("/api/consumer/growth")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> growth(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        BigDecimal totalConsume = jdbc.queryForObject("SELECT COALESCE(total_consume,0) FROM s2b2c_consumer WHERE id=?",
                BigDecimal.class, consumerId);
        if (totalConsume == null) {
            totalConsume = BigDecimal.ZERO;
        }
        int growth = totalConsume.setScale(0, RoundingMode.FLOOR).intValue();
        String level;
        String nextLevel;
        Integer nextThreshold;
        if (growth < 500) {
            level = "NORMAL";
            nextLevel = "SILVER";
            nextThreshold = 500;
        } else if (growth < 2000) {
            level = "SILVER";
            nextLevel = "GOLD";
            nextThreshold = 2000;
        } else if (growth < 5000) {
            level = "GOLD";
            nextLevel = "PLATINUM";
            nextThreshold = 5000;
        } else if (growth < 20000) {
            level = "PLATINUM";
            nextLevel = "DIAMOND";
            nextThreshold = 20000;
        } else {
            level = "DIAMOND";
            nextLevel = null;
            nextThreshold = null;
        }
        List<Map<String, Object>> records = jdbc.query("""
                SELECT create_time AS createTime,type,reason,points,balance
                FROM s2b2c_points_log WHERE consumer_id=? AND type='ORDER'
                ORDER BY create_time DESC,id DESC
                """, (rs, rowNum) -> row(
                "time", rs.getString("createTime"), "type", rs.getString("type"),
                "description", rs.getString("reason"), "value", rs.getInt("points"),
                "balance", rs.getInt("balance")), consumerId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalConsume", totalConsume);
        data.put("growth", growth);
        data.put("level", level);
        data.put("nextLevel", nextLevel);
        data.put("nextThreshold", nextThreshold);
        data.put("records", records);
        return ResponseEntity.ok(data);
    }

    // ── 内部辅助 ────────────────────────────────────────────────────────

    /**
     * 积分兑换的换算口径（本模块产品定义，非平台通用规则）：
     * <ul>
     *   <li>满减/固定金额券：1 元 ≈ 10 积分，pointsCost = round(amount × 10)；</li>
     *   <li>折扣券没有面额，按使用门槛折算：pointsCost = round(minAmount × 2)；</li>
     *   <li>任何券最低 50 积分，避免低价券把积分体系打穿。</li>
     * </ul>
     */
    private int pointsCost(String type, BigDecimal amount, BigDecimal minAmount) {
        boolean discount = "DISCOUNT".equalsIgnoreCase(type);
        BigDecimal base = discount ? minAmount : amount;
        if (base == null) {
            base = BigDecimal.ZERO;
        }
        int cost = (discount ? base.multiply(BigDecimal.valueOf(2)) : base.multiply(BigDecimal.TEN))
                .setScale(0, RoundingMode.HALF_UP).intValue();
        return Math.max(50, cost);
    }

    private int pointsOf(Long consumerId) {
        Integer points = jdbc.queryForObject("SELECT COALESCE(points,0) FROM s2b2c_consumer WHERE id=?",
                Integer.class, consumerId);
        return points == null ? 0 : points;
    }

    /** 商品 images 存的是 JSON 数组字符串，取第一张；解析失败按契约给 null。 */
    private String firstImage(String images) {
        if (images == null || images.isBlank()) {
            return null;
        }
        try {
            List<String> list = objectMapper.readValue(images, new TypeReference<List<String>>() {});
            return list.isEmpty() ? null : list.get(0);
        } catch (Exception ignored) {
            return null;
        }
    }

    private int clampSize(int size, int fallback, int max) {
        if (size <= 0) {
            return fallback;
        }
        return Math.min(size, max);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private Map<String, Object> row(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }

    private String text(Object value, String fallback) {
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    /** tags 请求体既可能是数组也可能是逗号串，统一落成 VARCHAR(200) 的逗号分隔文本。 */
    private String tagsText(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Iterable<?> iterable) {
            List<String> parts = new ArrayList<>();
            for (Object item : iterable) {
                if (item != null && !String.valueOf(item).isBlank()) {
                    parts.add(String.valueOf(item).trim());
                }
            }
            return parts.isEmpty() ? null : trimTo(String.join(",", parts), 200);
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : trimTo(text, 200);
    }

    private String imagesText(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Iterable<?> iterable) {
            try {
                return objectMapper.writeValueAsString(iterable);
            } catch (Exception ignored) {
                return null;
            }
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String trimTo(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private Long longValue(Object value) {
        try { return value == null ? null : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private Integer intValue(Object value) {
        try { return value == null ? null : new BigDecimal(String.valueOf(value)).intValue(); }
        catch (NumberFormatException ignored) { return null; }
    }

    private Boolean boolValue(Object value) {
        if (value == null) {
            return Boolean.FALSE;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
