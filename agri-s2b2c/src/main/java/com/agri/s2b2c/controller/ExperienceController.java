package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.security.SecurityUtils;
import com.agri.s2b2c.service.AfterSaleNoticeService;
import com.agri.s2b2c.service.AfterSaleRefundService;
import com.agri.s2b2c.service.ChannelIdentityService;
import com.agri.s2b2c.service.CommissionSettlementService;
import com.agri.s2b2c.service.ConsumerIdentityService;
import com.agri.s2b2c.service.OrderStatus;
import com.agri.s2b2c.service.SupplierIdentityService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class ExperienceController {

    private final CommissionSettlementService commissionSettlementService;
    private final AfterSaleRefundService afterSaleRefundService;
    private final AfterSaleNoticeService afterSaleNoticeService;
    private final ConsumerIdentityService consumerIdentityService;
    private final ChannelIdentityService channelIdentityService;
    private final SupplierIdentityService supplierIdentityService;
    private final JdbcTemplate jdbc;

    public ExperienceController(JdbcTemplate jdbc, CommissionSettlementService commissionSettlementService,
                                AfterSaleRefundService afterSaleRefundService,
                                AfterSaleNoticeService afterSaleNoticeService,
                                ConsumerIdentityService consumerIdentityService,
                                ChannelIdentityService channelIdentityService,
                                SupplierIdentityService supplierIdentityService) {
        this.jdbc = jdbc;
        this.commissionSettlementService = commissionSettlementService;
        this.afterSaleRefundService = afterSaleRefundService;
        this.afterSaleNoticeService = afterSaleNoticeService;
        this.consumerIdentityService = consumerIdentityService;
        this.channelIdentityService = channelIdentityService;
        this.supplierIdentityService = supplierIdentityService;
    }

    @GetMapping("/api/consumer/marketing")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> consumerMarketing() {
        return ResponseEntity.ok(Map.of(
                "coupons", jdbc.query("""
                        SELECT id,name,type,amount,discount_rate AS discountRate,min_amount AS minAmount,
                               remain_count AS remainCount,valid_start AS validStart,valid_end AS validEnd
                        FROM s2b2c_coupon WHERE status='ACTIVE' AND remain_count > 0
                          AND valid_start <= CURDATE() AND valid_end >= CURDATE()
                          AND (budget IS NULL OR budget_used < budget) ORDER BY amount DESC,id
                        """, (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "name", rs.getString("name"), "type", rs.getString("type"),
                        "amount", rs.getBigDecimal("amount"), "discountRate", rs.getBigDecimal("discountRate"),
                        "minAmount", rs.getBigDecimal("minAmount"), "remainCount", rs.getInt("remainCount"),
                        "validStart", rs.getString("validStart"), "validEnd", rs.getString("validEnd"))),
                "flashSales", jdbc.query("""
                        SELECT f.id,f.sale_price AS salePrice,f.original_price AS originalPrice,f.remain_stock AS remainStock,
                               f.total_stock AS totalStock,f.start_time AS startTime,f.end_time AS endTime,f.status,
                               p.id AS productId,p.name AS productName,p.unit
                        FROM s2b2c_flash_sale f JOIN s2b2c_product p ON p.id=f.product_id
                        WHERE f.status IN ('ACTIVE','RUNNING') AND f.start_time <= NOW() AND f.end_time >= NOW()
                          AND (f.budget IS NULL OR f.budget_used < f.budget)
                        ORDER BY f.start_time DESC
                        """, (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "productId", rs.getLong("productId"),
                        "productName", rs.getString("productName"), "salePrice", rs.getBigDecimal("salePrice"),
                        "originalPrice", rs.getBigDecimal("originalPrice"), "remainStock", rs.getInt("remainStock"),
                        "totalStock", rs.getInt("totalStock"), "unit", rs.getString("unit"),
                        "startTime", rs.getString("startTime"), "endTime", rs.getString("endTime"),
                        "status", rs.getString("status"))),
                "groupBuys", jdbc.query("""
                        SELECT g.id,g.name,g.single_price AS singlePrice,g.group_price AS groupPrice,
                               g.leader_price AS leaderPrice,g.group_size AS groupSize,g.valid_hours AS validHours,
                               g.start_time AS startTime,g.end_time AS endTime,g.status,
                               p.id AS productId,p.name AS productName,p.unit
                        FROM s2b2c_group_buy g JOIN s2b2c_product p ON p.id=g.product_id
                        WHERE g.status = 'ACTIVE' AND g.start_time <= NOW() AND g.end_time >= NOW()
                          AND (g.budget IS NULL OR g.budget_used < g.budget)
                        ORDER BY g.start_time DESC
                        """, (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "productId", rs.getLong("productId"),
                        "productName", rs.getString("productName"), "name", rs.getString("name"),
                        "singlePrice", rs.getBigDecimal("singlePrice"), "groupPrice", rs.getBigDecimal("groupPrice"),
                        "leaderPrice", rs.getBigDecimal("leaderPrice"), "groupSize", rs.getInt("groupSize"),
                        "validHours", rs.getInt("validHours"), "unit", rs.getString("unit"),
                        "startTime", rs.getString("startTime"), "endTime", rs.getString("endTime"),
                        "status", rs.getString("status")))
        ));
    }

    /**
     * 领取优惠券。
     *
     * <p>原先 consumerId 是请求参数 —— 任何人都能替任意消费者领券（并且真的会扣券的库存），
     * 券的"每人限领"也就成了摆设。身份一律从令牌取，参数直接不接。</p>
     */
    @PostMapping("/api/consumer/coupon/receive")
    @OperatorOnly("s2b2c:consumer")
    @Transactional
    public ResponseEntity<Map<String, Object>> receiveCoupon(@RequestParam Long couponId) {
        Long consumerId = consumerIdentityService.current().getId();
        Integer owned = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_coupon_user WHERE coupon_id=? AND consumer_id=?",
                Integer.class, couponId, consumerId);
        if (owned != null && owned > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该优惠券已领取"));
        }
        int updated = jdbc.update(
                "UPDATE s2b2c_coupon SET remain_count=remain_count-1 WHERE id=? AND status='ACTIVE' "
                        + "AND remain_count>0 AND valid_start <= CURDATE() AND valid_end >= CURDATE() "
                        + "AND (budget IS NULL OR budget_used < budget)",
                couponId);
        if (updated == 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "优惠券已领完或已失效"));
        }
        jdbc.update("""
                INSERT INTO s2b2c_coupon_user (id,coupon_id,consumer_id,status,receive_time)
                VALUES (?,?,?, 'UNUSED',?)
                """, System.currentTimeMillis(), couponId, consumerId, LocalDateTime.now());
        return ResponseEntity.ok(Map.of("success", true, "message", "优惠券领取成功"));
    }

    @GetMapping("/api/consumer/coupons")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> consumerCoupons() {
        return ResponseEntity.ok(jdbc.query("""
                SELECT cu.id,cu.status,cu.receive_time AS receiveTime,c.id AS couponId,c.name,c.type,
                       c.amount,c.discount_rate AS discountRate,c.min_amount AS minAmount,
                       c.valid_start AS validStart,c.valid_end AS validEnd
                FROM s2b2c_coupon_user cu JOIN s2b2c_coupon c ON c.id=cu.coupon_id
                WHERE cu.consumer_id=? ORDER BY cu.receive_time DESC
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "couponId", rs.getLong("couponId"), "name", rs.getString("name"),
                "type", rs.getString("type"), "amount", rs.getBigDecimal("amount"),
                "discountRate", rs.getBigDecimal("discountRate"),
                "minAmount", rs.getBigDecimal("minAmount"),
                "validStart", rs.getString("validStart"), "validEnd", rs.getString("validEnd"),
                "status", rs.getString("status"), "receiveTime", rs.getString("receiveTime")),
                consumerIdentityService.current().getId()));
    }

    @GetMapping("/api/consumer/trace/{productId}")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> trace(@PathVariable Long productId) {
        return ResponseEntity.ok(jdbc.query("""
                SELECT id,batch_code AS batchCode,origin,planting_date AS plantingDate,harvest_date AS harvestDate,
                       processing_info AS processingInfo,quality_report AS qualityReport,storage_info AS storageInfo
                FROM s2b2c_traceability WHERE product_id=? ORDER BY harvest_date DESC
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "batchCode", rs.getString("batchCode"), "origin", rs.getString("origin"),
                "plantingDate", rs.getString("plantingDate"), "harvestDate", rs.getString("harvestDate"),
                "processingInfo", rs.getString("processingInfo"), "qualityReport", rs.getString("qualityReport"),
                "storageInfo", rs.getString("storageInfo")), productId));
    }

    @GetMapping("/api/consumer/after-sales")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<List<Map<String, Object>>> consumerAfterSales() {
        return ResponseEntity.ok(jdbc.query("""
                SELECT id,order_id AS orderId,order_item_id AS orderItemId,type,reason,amount,status,
                       handle_opinion AS handleOpinion,return_company AS returnCompany,
                       return_logistics_no AS returnLogisticsNo,return_shipped_at AS returnShippedAt,
                       return_received_at AS returnReceivedAt,create_time AS createTime
                FROM s2b2c_after_sale WHERE consumer_id=? ORDER BY create_time DESC
                """, (rs, rowNum) -> row(
                "id", rs.getLong("id"), "orderId", rs.getLong("orderId"),
                "orderItemId", rs.getObject("orderItemId"),
                "type", rs.getString("type"), "reason", rs.getString("reason"),
                "amount", rs.getBigDecimal("amount"), "status", rs.getString("status"),
                "handleOpinion", rs.getString("handleOpinion"),
                "returnCompany", rs.getString("returnCompany"),
                "returnLogisticsNo", rs.getString("returnLogisticsNo"),
                "returnShippedAt", rs.getString("returnShippedAt"),
                "returnReceivedAt", rs.getString("returnReceivedAt"),
                "createTime", rs.getString("createTime")), consumerIdentityService.current().getId()));
    }

    /**
     * 提交售后。申请人取令牌，<b>请求体里的 consumerId 不再采信</b> ——
     * 否则换个数字就能替别人发起退款申请，而这条链后面直接连着退款与佣金回退。
     */
    @PostMapping("/api/consumer/after-sales")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> createAfterSale(@RequestBody Map<String, Object> body) {
        Long consumerId = consumerIdentityService.current().getId();
        Long orderId = longValue(body.get("orderId"));
        String type = text(body.get("type"), "REFUND");
        String reason = text(body.get("reason"), "售后申请");
        BigDecimal amount = decimal(body.get("amount"), BigDecimal.ZERO);
        List<Map<String, Object>> orders = jdbc.queryForList(
                "SELECT status, pay_amount AS payAmount FROM s2b2c_order WHERE id = ? AND consumer_id = ?",
                orderId, consumerId);
        if (orders.isEmpty() || amount.signum() <= 0) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "订单不存在或售后金额无效"));
        }
        Map<String, Object> order = orders.get(0);
        if (!OrderStatus.AFTER_SALE_ALLOWED.contains(String.valueOf(order.get("status")))) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "订单「" + OrderStatus.label(String.valueOf(order.get("status"))) + "」不可申请售后"));
        }
        if (amount.compareTo(decimal(order.get("payAmount"), BigDecimal.ZERO)) > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "售后金额不能超过订单实付金额"));
        }
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM s2b2c_after_sale WHERE order_id = ? AND status IN ('PENDING','APPROVED')",
                Integer.class, orderId);
        if (existing != null && existing > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "该订单已有处理中或已通过的售后"));
        }
        long afterSaleId = System.currentTimeMillis();
        jdbc.update("""
                INSERT INTO s2b2c_after_sale
                (id,order_id,consumer_id,type,reason,amount,status,create_time)
                VALUES (?,?,?,?,?,?, 'PENDING',?)
                """, afterSaleId, orderId, consumerId, type, reason, amount, LocalDateTime.now());
        afterSaleNoticeService.applied(afterSaleId);
        return ResponseEntity.ok(Map.of("success", true, "message", "售后申请已提交"));
    }

    /**
     * 渠道增长视图（本渠道的佣金与售后）。
     *
     * <p>channelId 参数不再采信：移动端此前默认传 1，等于任何渠道账号都能看到渠道 1 的佣金明细。
     * 归属由令牌解析，多余的请求参数会被 Spring 忽略，老前端不会因此报 400。</p>
     */
    @GetMapping("/api/channel/growth")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelGrowth() {
        Long channelId = channelIdentityService.requireCurrent().getId();
        return ResponseEntity.ok(Map.of(
                "marketing", consumerMarketing().getBody(),
                "commissions", jdbc.query("""
                        SELECT id,order_id AS orderId,amount,rate,status,create_time AS createTime
                        FROM s2b2c_commission WHERE channel_id=? ORDER BY create_time DESC
                        """, (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "orderId", rs.getLong("orderId"),
                        "amount", rs.getBigDecimal("amount"), "rate", rs.getBigDecimal("rate"),
                        "status", rs.getString("status"), "createTime", rs.getString("createTime")), channelId),
                "afterSales", jdbc.query("""
                        SELECT a.id,a.order_id AS orderId,a.type,a.reason,a.amount,a.status,
                               a.handle_opinion AS handleOpinion,a.create_time AS createTime
                        FROM s2b2c_after_sale a JOIN s2b2c_order o ON o.id=a.order_id
                        WHERE o.channel_id=? ORDER BY a.create_time DESC
                        """, (rs, rowNum) -> afterSaleRow(rs), channelId)
        ));
    }

    /** 买家填写退货物流（仅 RETURNING 状态、仅本人售后单）。 */
    @PutMapping("/api/consumer/after-sales/{id}/return")
    @OperatorOnly("s2b2c:consumer")
    public ResponseEntity<Map<String, Object>> submitReturn(@PathVariable Long id,
                                                            @RequestParam String company,
                                                            @RequestParam String logisticsNo) {
        Long consumerId = consumerIdentityService.current().getId();
        if (company == null || company.isBlank() || logisticsNo == null || logisticsNo.isBlank()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写退货物流公司与单号"));
        }
        boolean success = afterSaleRefundService.submitReturn(id, consumerId, company.trim(), logisticsNo.trim());
        return ResponseEntity.ok(Map.of("success", success,
                "message", success ? "退货物流已提交，等待商家确认收货" : "当前售后单不能提交退货物流"));
    }

    /** 平台确认收到退货并退款。 */
    @PutMapping("/api/platform/after-sale/{id}/confirm-return")
    @OperatorOnly("s2b2c:admin")
    public ResponseEntity<Map<String, Object>> confirmReturn(@PathVariable Long id,
                                                             @RequestParam(required = false) String opinion) {
        AfterSaleRefundService.Result result = afterSaleRefundService.confirmReturn(id, opinion);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("success", result.success());
        data.put("message", result.message());
        data.put("fullRefund", result.fullRefund());
        return ResponseEntity.ok(data);
    }

    @GetMapping("/api/platform/growth")
    @OperatorOnly("s2b2c:admin")
    public ResponseEntity<Map<String, Object>> platformGrowth() {
        return ResponseEntity.ok(Map.of(
                "marketing", consumerMarketing().getBody(),
                "afterSales", jdbc.query("""
                        SELECT a.id,a.order_id AS orderId,a.consumer_id AS consumerId,a.type,a.reason,a.amount,
                               a.status,a.handle_opinion AS handleOpinion,a.create_time AS createTime
                        FROM s2b2c_after_sale a ORDER BY a.status='PENDING' DESC,a.create_time DESC
                        """, (rs, rowNum) -> afterSaleRow(rs)),
                "commissionSummary", jdbc.queryForMap("""
                        SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount,
                               SUM(CASE WHEN status='SETTLED' THEN 1 ELSE 0 END) AS settledCount
                        FROM s2b2c_commission
                        """),
                "pendingShipOrders", jdbc.query("""
                        SELECT id,order_no AS orderNo,consumer_id AS consumerId,total_amount AS totalAmount,
                               pay_amount AS payAmount,status,create_time AS createTime
                        FROM s2b2c_order WHERE status='PENDING_SHIP' ORDER BY create_time DESC
                        """, (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "orderNo", rs.getString("orderNo"),
                        "consumerId", rs.getLong("consumerId"), "totalAmount", rs.getBigDecimal("totalAmount"),
                        "payAmount", rs.getBigDecimal("payAmount"), "status", rs.getString("status"),
                        "createTime", rs.getString("createTime"))),
                "commissions", jdbc.query("""
                        SELECT id,order_id AS orderId,channel_id AS channelId,amount,rate,status,create_time AS createTime
                        FROM s2b2c_commission ORDER BY create_time DESC LIMIT 50
                        """, (rs, rowNum) -> row(
                        "id", rs.getLong("id"), "orderId", rs.getLong("orderId"),
                        "channelId", rs.getLong("channelId"), "amount", rs.getBigDecimal("amount"),
                        "rate", rs.getBigDecimal("rate"), "status", rs.getString("status"),
                        "createTime", rs.getString("createTime")))
        ));
    }

    @PutMapping("/api/platform/after-sale/review")
    @OperatorOnly("s2b2c:admin")
    public ResponseEntity<Map<String, Object>> reviewAfterSale(@RequestParam Long id,
                                                               @RequestParam String status,
                                                               @RequestParam(required = false) String opinion) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("APPROVED", "REJECTED").contains(normalized)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "处理结果只能是 APPROVED / REJECTED"));
        }
        AfterSaleRefundService.Result result = "APPROVED".equals(normalized)
                ? afterSaleRefundService.approve(id, opinion)
                : afterSaleRefundService.reject(id, opinion);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("success", result.success());
        data.put("message", result.message());
        data.put("fullRefund", result.fullRefund());
        return ResponseEntity.ok(data);
    }

    /**
     * 发货。
     *
     * <p>原先只按 {@code id + status='PENDING_SHIP'} 更新，<b>不问这单是不是你的</b>：
     * 任何持有 {@code s2b2c:fulfillment} 的供应商账号传别人的订单号就能把别人的货标记为已发货。
     * 现在先按令牌解析供应商档案并核对归属；平台运营（没有供应商档案）仍可代发，
     * 这是两类调用者的真实区别，不是给绕过留口子。</p>
     */
    @PutMapping("/api/platform/order/ship")
    @OperatorOnly("s2b2c:fulfillment")
    public ResponseEntity<Map<String, Object>> shipOrder(@RequestParam Long id,
                                                         @RequestParam String logisticsNo,
                                                         @RequestParam(required = false) String company) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT status, supplier_id AS supplierId FROM s2b2c_order WHERE id = ?", id);
        if (rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "订单不存在"));
        }
        Supplier mine = supplierIdentityService.currentOrNull();
        Long ownerSupplierId = rows.get(0).get("supplierId") == null
                ? null : ((Number) rows.get(0).get("supplierId")).longValue();
        if (mine != null && !mine.getId().equals(ownerSupplierId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false, "message", "这单不属于当前供应商店铺，无权发货"));
        }
        String status = String.valueOf(rows.get(0).get("status"));
        if (!OrderStatus.PENDING_SHIP.equals(status)) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", OrderStatus.rejectReason(status, OrderStatus.SHIPPED)));
        }
        int updated = jdbc.update("""
                UPDATE s2b2c_order SET status='SHIPPED',logistics_no=?,logistics_company=?,update_time=?
                WHERE id=? AND status='PENDING_SHIP'
                """, logisticsNo, company, LocalDateTime.now(), id);
        if (updated == 0) {
            // 走到这里说明状态刚被别人改过（并发发货），不能假装成功
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", "订单状态刚已变更，请刷新后重试"));
        }
        jdbc.update("""
                INSERT INTO s2b2c_logistics
                (id,order_id,logistics_no,logistics_company,tracking_info,status,create_time,update_time)
                VALUES (?,?,?,?,?, 'SHIPPED',?,?)
                """, System.currentTimeMillis(), id, logisticsNo, company,
                "商家已发货，等待物流揽收", LocalDateTime.now(), LocalDateTime.now());
        return ResponseEntity.ok(Map.of("success", true, "message", "发货成功"));
    }

    /**
     * 全量结算入口（无筛选条件）。与运营端结算页那条走<b>同一个服务、同一条规则</b>，
     * 操作人取令牌账号 —— 两条门做同一件花钱的事，规则不能有两份。
     */
    @PostMapping("/api/platform/commission/settle")
    @OperatorOnly("s2b2c:admin")
    public ResponseEntity<Map<String, Object>> settleCommissions() {
        CommissionSettlementService.SettlementResult result = commissionSettlementService
                .settle(null, null, null, currentOperator());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("success", result.count() > 0);
        data.put("settled", result.count());
        data.put("batchNo", result.batchNo() == null ? "" : result.batchNo());
        data.put("blockedCount", result.blockedCount());
        data.put("blockedAmount", result.blockedAmount());
        data.put("blocked", result.blocked());
        data.put("message", result.count() > 0
                ? "已结算 " + result.count() + " 笔" + (result.blockedCount() > 0
                        ? "，另有 " + result.blockedCount() + " 笔订单条件未满足" : "")
                : describeBlocked(result));
        return ResponseEntity.ok(data);
    }

    /** 被挡原因汇总：同一原因合并成一句，避免 200 笔刷屏。 */
    private String describeBlocked(CommissionSettlementService.SettlementResult result) {
        if (result.blockedCount() == 0) {
            return "所选范围内没有待结算佣金";
        }
        String detail = result.blocked().stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        CommissionSettlementService.Blocked::reason,
                        java.util.stream.Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(3)
                .map(entry -> entry.getKey() + " " + entry.getValue() + " 笔")
                .collect(java.util.stream.Collectors.joining("；"));
        return "有 " + result.blockedCount() + " 笔待结算佣金但都还不能结算：" + detail;
    }

    /** 操作人：取令牌账号，取不到就写 unknown，不冒充"平台运营"。 */
    private String currentOperator() {
        String username = com.agri.s2b2c.security.SecurityUtils.getUsername();
        return username == null || username.isBlank() ? "unknown" : username;
    }

    private Map<String, Object> afterSaleRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return row("id", rs.getLong("id"), "orderId", rs.getLong("orderId"),
                "type", rs.getString("type"), "reason", rs.getString("reason"),
                "amount", rs.getBigDecimal("amount"), "status", rs.getString("status"),
                "handleOpinion", rs.getString("handleOpinion"), "createTime", rs.getString("createTime"));
    }

    private Map<String, Object> row(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }

    private String text(Object value, String fallback) {
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private Long longValue(Object value) {
        try { return value == null ? null : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private BigDecimal decimal(Object value, BigDecimal fallback) {
        try { return value == null ? fallback : new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }
}
