package com.agri.service.repository;

import com.agri.common.exception.BusinessException;
import com.agri.service.security.ServiceIdentityService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 综合服务运营端与服务商工作台数据访问。
 *
 * <p>两条纪律：<b>操作人来自令牌</b>（原先写死"王运营"，前端还会传"陈仲裁""刘结算"，
 * 审计等于没记）；<b>服务商身份来自令牌</b>（原先 {@code providerId} 由 URL 自报，
 * 还有 {@code defaultValue = "1"} 兜底，任何人都能替别家接单、报进度）。</p>
 */
@Repository
public class OpsRepository {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter SERIAL_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final AtomicLong SERIAL = new AtomicLong();
    /** 政策申报状态机：只能顺着走，不能从"已拨付"一步退回"乡镇审核"。 */
    private static final Map<String, List<String>> POLICY_FLOW = Map.of(
            "submitted", List.of("town_review", "rejected"),
            "town_review", List.of("county_review", "rejected"),
            "county_review", List.of("paid", "rejected"),
            "paid", List.of(),
            "rejected", List.of());
    private static final Map<String, List<String>> CLAIM_FLOW = Map.of(
            "submitted", List.of("surveying", "rejected"),
            "surveying", List.of("assessing", "rejected"),
            "assessing", List.of("publicity", "rejected"),
            "publicity", List.of("paid", "rejected"),
            "paid", List.of("closed"),
            "closed", List.of(),
            "rejected", List.of());

    private final JdbcTemplate jdbc;
    private final ServiceIdentityService identity;
    private final ServiceRepository serviceRepository;

    public OpsRepository(JdbcTemplate jdbc, ServiceIdentityService identity, ServiceRepository serviceRepository) {
        this.jdbc = jdbc;
        this.identity = identity;
        this.serviceRepository = serviceRepository;
    }

    /* ==================== 运营大盘 ==================== */

    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("providers", number("SELECT COUNT(*) FROM service_provider WHERE status IN ('available','restricted')"));
        metrics.put("pendingProviders", number("SELECT COUNT(*) FROM service_provider WHERE status='pending'"));
        metrics.put("activeOrders", number("SELECT COUNT(*) FROM service_order WHERE status IN ('confirmed','in_progress')"));
        metrics.put("totalOrders", number("SELECT COUNT(*) FROM service_order"));
        metrics.put("gmv", decimalValue("SELECT COALESCE(SUM(total_amount),0) FROM service_order WHERE status<>'cancelled'"));
        metrics.put("platformFee", decimalValue("SELECT COALESCE(SUM(total_amount),0)*0.01 FROM service_order WHERE status<>'cancelled'"));
        metrics.put("openComplaints", number("SELECT COUNT(*) FROM service_complaint WHERE status<>'resolved'"));
        metrics.put("pendingPolicies", number("SELECT COUNT(*) FROM service_policy_application WHERE status NOT IN ('paid','rejected')"));
        metrics.put("pendingClaims", number("SELECT COUNT(*) FROM insurance_claim WHERE status NOT IN ('paid','closed')"));
        metrics.put("unboundProviders", number(
                "SELECT COUNT(*) FROM service_provider WHERE merchant_id IS NULL AND status<>'removed'"));
        result.put("metrics", metrics);
        result.put("trend", jdbc.query("SELECT * FROM service_daily_metric ORDER BY metric_date", dailyMapper()));
        result.put("todos", List.of(
                todo("service-provider", "服务商入驻待审核", metrics.get("pendingProviders"), "初审与复审"),
                todo("catalog", "服务商品待审核", number("SELECT COUNT(*) FROM service_item WHERE audit_status='pending'"), "目录与资质"),
                todo("disputes", "投诉纠纷待处理", metrics.get("openComplaints"), "质量仲裁与售后"),
                todo("settlement", "结算复核待执行", number("SELECT COUNT(*) FROM service_settlement WHERE status='pending'"), "T+1 分账批次"),
                todo("policies", "政策补贴申报待核", metrics.get("pendingPolicies"), "材料核验与兑付"),
                todo("claims", "理赔案件待跟进", metrics.get("pendingClaims"), "查勘、定损与公示"),
                todo("service-provider", "服务商未绑定平台主体", metrics.get("unboundProviders"), "工作台进不去，先补绑定")
        ));
        result.put("alerts", jdbc.query(
                "SELECT * FROM service_quality_alert WHERE status<>'closed' ORDER BY id", qualityAlertMapper()));
        result.put("regions", jdbc.query("""
                SELECT COALESCE(region, '未配置') AS region_name,
                       COUNT(*) AS provider_count,
                       ROUND(AVG(rating), 2) AS avg_rating
                FROM service_provider
                WHERE status IN ('available','restricted')
                GROUP BY COALESCE(region, '未配置')
                ORDER BY provider_count DESC
                LIMIT 8
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", rs.getString("region_name"));
            row.put("providers", rs.getInt("provider_count"));
            row.put("rating", rs.getBigDecimal("avg_rating"));
            return row;
        }));
        return result;
    }

    /* ==================== 服务商台账与审核 ==================== */

    public List<Map<String, Object>> providers(String status, String keyword) {
        StringBuilder sql = new StringBuilder("SELECT * FROM service_provider WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND status=?");
            args.add(status);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(region) LIKE ?)");
            String like = like(keyword);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append("""
                 ORDER BY CASE status
                   WHEN 'pending' THEN 0 WHEN 'restricted' THEN 1 WHEN 'available' THEN 2
                   WHEN 'frozen' THEN 3 WHEN 'removed' THEN 4 ELSE 5 END, created_at DESC
                """);
        return jdbc.query(sql.toString(), providerMapper(), args.toArray());
    }

    @Transactional
    public Map<String, Object> reviewProvider(long id, Map<String, Object> body) {
        Map<String, Object> provider = provider(id);
        String status = text(body, "status", "available");
        if (!List.of("available", "restricted", "frozen", "removed", "pending").contains(status)) {
            throw BusinessException.validationError("不支持的服务商状态：" + status);
        }
        String reason = required(body, "reason", "请填写审核意见（会通过站内信发给服务商）");
        String from = String.valueOf(provider.get("status"));
        if (from.equals(status)) {
            throw new BusinessException(409, "该服务商当前已经是「" + status + "」状态，无需重复审核");
        }
        // 清退/冻结前先看有没有未完结工单，否则工单会挂在一家已经不能接单的服务商名下
        if (("removed".equals(status) || "frozen".equals(status)) && hasOpenWork(id)) {
            throw new BusinessException(409, "该服务商还有未完结的工单，先处理完再冻结或清退");
        }
        jdbc.update("UPDATE service_provider SET status=?, audit_reason=? WHERE id=?", status, reason, id);
        log("服务商审核", "SV" + id + " · " + provider.get("name"),
                "状态由「" + from + "」更新为「" + status + "」；" + reason);
        notifyProvider(id, "服务商审核结果",
                "你的服务商档案「" + provider.get("name") + "」审核结论：" + status + "。" + reason);
        return provider(id);
    }

    private boolean hasOpenWork(long providerId) {
        return number("SELECT COUNT(*) FROM service_order WHERE provider_id=?"
                + " AND status IN ('confirmed','in_progress')", providerId) > 0;
    }

    /**
     * 服务商档案 ↔ 平台经营主体绑定。
     *
     * <p>服务商工作台能不能进、接单落给谁，全靠这条绑定；由运营显式建立，
     * 不按名称猜（同名不等于同一家）。</p>
     */
    @Transactional
    public Map<String, Object> bindMerchant(long providerId, Object merchantId) {
        Map<String, Object> provider = provider(providerId);
        String value = merchantId == null ? "" : String.valueOf(merchantId).trim();
        if (value.isEmpty()) {
            jdbc.update("UPDATE service_provider SET merchant_id=NULL WHERE id=?", providerId);
            log("解除服务商绑定", "SV" + providerId + " · " + provider.get("name"),
                    "解绑后该经营主体无法进入服务商工作台");
            return provider(providerId);
        }
        long merchant = parseLongOrThrow(value, "经营主体号格式不正确：" + merchantId);
        String merchantName = identity.merchantNameOf(merchant);
        if (merchantName == null) {
            throw new BusinessException(409, "平台不存在经营主体 " + merchant
                    + "，不能绑定。请先在平台「商户管理」确认主体号，或留空解除绑定");
        }
        List<Map<String, Object>> conflict = jdbc.query(
                "SELECT id,name FROM service_provider WHERE merchant_id=? AND id<>?",
                (rs, rowNum) -> Map.of("id", rs.getLong("id"), "name", rs.getString("name")),
                merchant, providerId);
        if (!conflict.isEmpty()) {
            throw new BusinessException(409, "该经营主体已经绑定在服务商档案「" + conflict.get(0).get("name")
                    + "」（id=" + conflict.get(0).get("id") + "）上，一个主体只能对应一家服务商");
        }
        jdbc.update("UPDATE service_provider SET merchant_id=? WHERE id=?", merchant, providerId);
        log("服务商绑定经营主体", "SV" + providerId + " · " + provider.get("name"),
                "绑定平台经营主体 " + merchant + "（" + merchantName + "）");
        notifyProvider(providerId, "服务商档案已绑定平台主体",
                "档案「" + provider.get("name") + "」已绑定平台经营主体「" + merchantName
                        + "」，可用该主体下的账号登录工作台。");
        return provider(providerId);
    }

    public Map<String, Object> provider(long id) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM service_provider WHERE id=?", providerMapper(), id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("服务商不存在：" + id);
        }
        Map<String, Object> provider = rows.get(0);
        provider.put("items", jdbc.query("""
                SELECT i.*, p.name AS provider_name, p.region AS provider_region
                FROM service_item i JOIN service_provider p ON p.id=i.provider_id
                WHERE i.provider_id=? ORDER BY i.id
                """, serviceItemMapper(), id));
        provider.put("orders", jdbc.query("""
                SELECT id,order_no AS orderNo,service_name AS serviceName,total_amount AS totalAmount,
                       status,progress,appointment_date AS appointmentDate
                FROM service_order WHERE provider_id=? ORDER BY id DESC LIMIT 10
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(rs.getLong("id")));
            row.put("orderNo", rs.getString("orderNo"));
            row.put("serviceName", rs.getString("serviceName"));
            row.put("totalAmount", rs.getBigDecimal("totalAmount"));
            row.put("status", rs.getString("status"));
            row.put("progress", rs.getInt("progress"));
            row.put("appointmentDate", rs.getString("appointmentDate"));
            return row;
        }, id));
        return provider;
    }

    /* ==================== 服务商品审核 ==================== */

    public List<Map<String, Object>> serviceItems(String auditStatus, String keyword) {
        StringBuilder sql = new StringBuilder("""
                SELECT i.*, p.name AS provider_name, p.region AS provider_region, p.badge AS provider_badge
                FROM service_item i LEFT JOIN service_provider p ON p.id=i.provider_id WHERE 1=1
                """);
        List<Object> args = new ArrayList<>();
        if (auditStatus != null && !auditStatus.isBlank() && !"all".equals(auditStatus)) {
            sql.append(" AND i.audit_status=?");
            args.add(auditStatus);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(i.name) LIKE ? OR LOWER(p.name) LIKE ?)");
            String like = like(keyword);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY CASE i.audit_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, i.id");
        return jdbc.query(sql.toString(), serviceItemMapper(), args.toArray());
    }

    @Transactional
    public Map<String, Object> reviewServiceItem(long id, Map<String, Object> body) {
        // 这条前置读用的是 serviceItemMapper，少给一列就会在 set 阶段抛 "Column not found" 变成 500
        Map<String, Object> item = jdbc.query("""
                SELECT i.*, p.name AS provider_name, p.region AS provider_region, p.badge AS provider_badge
                FROM service_item i
                JOIN service_provider p ON p.id=i.provider_id WHERE i.id=?
                """, serviceItemMapper(), id).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("服务商品不存在：" + id));
        String auditStatus = text(body, "auditStatus", "approved");
        if (!List.of("approved", "rejected", "pending").contains(auditStatus)) {
            throw BusinessException.validationError("不支持的审核状态：" + auditStatus);
        }
        String reason = required(body, "reason", "请填写审核意见");
        String itemStatus = "approved".equals(auditStatus) ? "enabled" : "pending";
        jdbc.update("UPDATE service_item SET audit_status=?, status=?, audit_reason=? WHERE id=?",
                auditStatus, itemStatus, reason, id);
        log("服务商品审核", String.valueOf(item.get("name")),
                ("approved".equals(auditStatus) ? "通过上架" : "驳回或退回") + "；" + reason);
        notifyProvider(longValue(item.get("providerId")), "服务商品审核结果",
                "商品「" + item.get("name") + "」审核结论：" + auditStatus + "。" + reason);
        return serviceItems("all", null).stream()
                .filter(row -> String.valueOf(row.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    /* ==================== 订单派单与改派 ==================== */

    public List<Map<String, Object>> orders(String status, String keyword) {
        StringBuilder sql = new StringBuilder("SELECT * FROM service_order WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND status=?");
            args.add(status);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(order_no) LIKE ? OR LOWER(provider_name) LIKE ? OR LOWER(service_name) LIKE ?)");
            String like = like(keyword);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY CASE WHEN risk_flag IS NOT NULL THEN 0 ELSE 1 END, created_at DESC");
        return jdbc.query(sql.toString(), orderMapper(), args.toArray());
    }

    /** 运营派单/改派：必须点名服务商，且不能派给不可接单的档案。 */
    @Transactional
    public Map<String, Object> dispatchOrder(long id, Map<String, Object> body) {
        Map<String, Object> order = order(id);
        long providerId = requiredLong(body.get("providerId"), "请选择目标服务商");
        Map<String, Object> provider = provider(providerId);
        if (!"available".equals(provider.get("status"))) {
            throw new BusinessException(409, "目标服务商当前不可接单（" + provider.get("status") + "）");
        }
        String status = String.valueOf(order.get("status"));
        if (List.of("completed", "cancelled").contains(status)) {
            throw new BusinessException(409, "订单已" + ("completed".equals(status) ? "完成" : "取消") + "，不能再改派");
        }
        String note = required(body, "note", "请填写派单说明");
        jdbc.update("""
                UPDATE service_order
                SET provider_id=?, provider_name=?, status='confirmed', progress=35,
                    dispatch_status='dispatched', risk_flag=NULL
                WHERE id=?
                """, providerId, provider.get("name"), id);
        jdbc.update("""
                INSERT INTO service_order_event (order_id,title,note,event_time,completed)
                VALUES (?, '运营人工派单', ?, ?, TRUE)
                """, id, note, LocalDateTime.now().format(DATE_TIME));
        log("人工派单", String.valueOf(order.get("orderNo")),
                "由「" + order.get("providerName") + "」改派至 " + provider.get("name") + "；" + note);
        notifyMerchant(order, "订单已派单",
                "订单 " + order.get("orderNo") + " 已指派给「" + provider.get("name") + "」。" + note);
        return order(id);
    }

    private Map<String, Object> order(long id) {
        return jdbc.query("SELECT * FROM service_order WHERE id=?", orderMapper(), id).stream()
                .findFirst().orElseThrow(() -> BusinessException.notFound("订单不存在：" + id));
    }

    public List<Map<String, Object>> dispatchDemands() {
        return jdbc.query("""
                SELECT d.*, (
                  SELECT COUNT(*) FROM service_provider p
                  WHERE p.category=d.category AND p.status='available'
                ) available_provider_count
                FROM service_demand d
                WHERE d.status IN ('matching','quoted')
                ORDER BY CASE WHEN d.preferred_date IS NULL THEN 1 ELSE 0 END, d.preferred_date, d.created_at
                """, (rs, rowNum) -> {
            Map<String, Object> item = demandMap(rs);
            item.put("availableProviderCount", rs.getInt("available_provider_count"));
            return item;
        });
    }

    /** 指派需求并生成工单：工单归属沿用需求发布方主体，不再缺省给 1 号服务商。 */
    @Transactional
    public Map<String, Object> assignDemand(long demandId, Map<String, Object> body) {
        long providerId = requiredLong(body.get("providerId"), "请选择目标服务商");
        Map<String, Object> provider = provider(providerId);
        if (!"available".equals(provider.get("status"))) {
            throw new BusinessException(409, "目标服务商当前不可接单（" + provider.get("status") + "）");
        }
        Map<String, Object> demand = demandRow(demandId);
        if (!List.of("matching", "quoted").contains(String.valueOf(demand.get("status")))) {
            throw new BusinessException(409, "需求当前是「" + demand.get("status") + "」，不能指派");
        }
        jdbc.update("""
                UPDATE service_demand
                SET status='assigned', accepted_provider_id=?, accepted_provider_name=?
                WHERE id=? AND status IN ('matching','quoted')
                """, providerId, provider.get("name"), demandId);
        BigDecimal quantity = parseQuantity(String.valueOf(demand.get("area")));
        BigDecimal unitPrice = (BigDecimal) provider.get("price");
        BigDecimal total = unitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        String orderNo = createWorkOrder(providerId, provider, demand, quantity, unitPrice, total, "dispatched");
        log("需求派单", "DM" + demandId, "指派给 " + provider.get("name") + "，生成工单 " + orderNo);
        notifyMerchant(demand, "需求已指派服务商",
                "需求 " + demand.get("demandNo") + " 已指派给「" + provider.get("name") + "」，工单号 " + orderNo + "。");
        notifyProvider(providerId, "有新工单指派给你",
                "工单 " + orderNo + "（" + demand.get("serviceName") + "）已指派，请及时联系需求方确认档期。");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("demandId", String.valueOf(demandId));
        result.put("providerName", provider.get("name"));
        result.put("status", "assigned");
        result.put("orderNo", orderNo);
        return result;
    }

    private BigDecimal parseQuantity(String value) {
        try {
            return new BigDecimal(value.replaceAll("[^0-9.]", ""));
        } catch (Exception ignored) {
            return BigDecimal.ONE;
        }
    }

    /* ==================== 投诉、申报、理赔、结算 ==================== */

    public List<Map<String, Object>> complaints() {
        return jdbc.query("SELECT * FROM service_complaint ORDER BY status='resolved', created_at DESC", complaintMapper());
    }

    @Transactional
    public Map<String, Object> resolveComplaint(long id, Map<String, Object> body) {
        Map<String, Object> complaint = jdbc.query("SELECT * FROM service_complaint WHERE id=?",
                        complaintMapper(), id).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("投诉工单不存在：" + id));
        String status = text(body, "status", "resolved");
        if (!List.of("processing", "resolved", "rejected").contains(status)) {
            throw BusinessException.validationError("不支持的工单状态：" + status);
        }
        if ("resolved".equals(String.valueOf(complaint.get("status")))) {
            throw new BusinessException(409, "该工单已办结，不能重复处理");
        }
        String resolution = required(body, "resolution", "请填写处理结论（会原样发给投诉方）");
        // 处理人一律取当前登录运营：原先由前端传"陈仲裁"，审计字段等于可以编造
        String handler = identity.requireOperatorName();
        int progress = "resolved".equals(status) ? 100 : 65;
        jdbc.update("UPDATE service_complaint SET status=?,progress=?,handler=?,resolution=? WHERE id=?",
                status, progress, handler, resolution, id);
        log("投诉处理", String.valueOf(complaint.get("complaintNo")), resolution);
        notifyMerchant(complaint, "投诉处理结论",
                "工单 " + complaint.get("complaintNo") + " 处理结论：" + resolution + "（处理人 " + handler + "）");
        return complaints().stream()
                .filter(item -> String.valueOf(item.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    public List<Map<String, Object>> policyApplications() {
        return jdbc.query("SELECT * FROM service_policy_application ORDER BY status='paid', submitted_at DESC",
                applicationMapper());
    }

    @Transactional
    public Map<String, Object> reviewPolicy(long id, Map<String, Object> body) {
        Map<String, Object> application = jdbc.query("SELECT * FROM service_policy_application WHERE id=?",
                        applicationMapper(), id).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("政策申报不存在：" + id));
        String from = String.valueOf(application.get("status"));
        String status = text(body, "status", "town_review");
        List<String> allowed = POLICY_FLOW.getOrDefault(from, List.of());
        if (!allowed.contains(status)) {
            throw new BusinessException(409, "申报当前是「" + from + "」，只能推进到："
                    + (allowed.isEmpty() ? "无（已终态）" : String.join("、", allowed)));
        }
        String note = required(body, "note", "请填写审核意见");
        int progress = switch (status) {
            case "submitted" -> 20;
            case "town_review" -> 45;
            case "county_review" -> 70;
            case "paid", "rejected" -> 100;
            default -> 45;
        };
        jdbc.update("UPDATE service_policy_application SET status=?, progress=? WHERE id=?", status, progress, id);
        log("政策审核", String.valueOf(application.get("applicationNo")),
                "由「" + from + "」更新为「" + status + "」；" + note);
        notifyMerchant(application, "政策申报进度更新",
                "《" + application.get("policyTitle") + "》申报 " + application.get("applicationNo")
                        + " 当前状态：" + status + "。" + note);
        return policyApplications().stream()
                .filter(item -> String.valueOf(item.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    public List<Map<String, Object>> claims() {
        return jdbc.query("SELECT * FROM insurance_claim ORDER BY status NOT IN ('paid','closed'), created_at DESC",
                claimMapper());
    }

    @Transactional
    public Map<String, Object> reviewClaim(long id, Map<String, Object> body) {
        Map<String, Object> claim = jdbc.query("SELECT * FROM insurance_claim WHERE id=?", claimMapper(), id)
                .stream().findFirst().orElseThrow(() -> BusinessException.notFound("理赔案件不存在：" + id));
        String from = String.valueOf(claim.get("status"));
        String status = text(body, "status", "surveying");
        List<String> allowed = CLAIM_FLOW.getOrDefault(from, List.of());
        if (!allowed.contains(status)) {
            throw new BusinessException(409, "案件当前是「" + from + "」，只能推进到："
                    + (allowed.isEmpty() ? "无（已终态）" : String.join("、", allowed)));
        }
        String note = required(body, "note", "请填写跟进说明");
        int progress = switch (status) {
            case "submitted" -> 20;
            case "surveying" -> 45;
            case "assessing" -> 70;
            case "publicity" -> 85;
            case "paid", "closed", "rejected" -> 100;
            default -> 45;
        };
        jdbc.update("UPDATE insurance_claim SET status=?,progress=? WHERE id=?", status, progress, id);
        if ("paid".equals(status)) {
            jdbc.update("UPDATE insurance_policy SET status='closed' WHERE policy_no=?", claim.get("policyNo"));
        }
        log("理赔跟进", String.valueOf(claim.get("claimNo")),
                "由「" + from + "」更新为「" + status + "」；" + note);
        notifyMerchant(claim, "理赔进度更新",
                "案件 " + claim.get("claimNo") + " 当前状态：" + status + "。" + note);
        return claims().stream()
                .filter(item -> String.valueOf(item.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    public List<Map<String, Object>> settlements() {
        return jdbc.query("SELECT * FROM service_settlement ORDER BY created_at DESC", settlementMapper());
    }

    @Transactional
    public Map<String, Object> reviewSettlement(long id, Map<String, Object> body) {
        Map<String, Object> batch = jdbc.query("SELECT * FROM service_settlement WHERE id=?",
                        settlementMapper(), id).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("结算批次不存在：" + id));
        if (!"pending".equals(String.valueOf(batch.get("status")))) {
            throw new BusinessException(409, "该批次已复核（" + batch.get("status") + "），不能重复复核");
        }
        String status = text(body, "status", "approved");
        if (!List.of("approved", "rejected").contains(status)) {
            throw BusinessException.validationError("复核结论只能是 approved 或 rejected");
        }
        String note = required(body, "note", "请填写复核意见");
        // 复核人取登录令牌，不再由前端传"刘结算"
        String reviewer = identity.requireOperatorName();
        jdbc.update("UPDATE service_settlement SET status=?, reviewed_by=?, reviewed_at=? WHERE id=?",
                status, reviewer, LocalDateTime.now().format(DATE_TIME), id);
        log("批次复核", String.valueOf(batch.get("batchNo")),
                "复核结果 " + status + "；" + note + "（" + batch.get("orderCount") + " 笔 / ¥"
                        + batch.get("amount") + "）");
        return settlements().stream()
                .filter(item -> String.valueOf(item.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    public List<Map<String, Object>> campaigns() {
        return jdbc.query("SELECT * FROM service_campaign ORDER BY id", campaignMapper());
    }

    @Transactional
    public Map<String, Object> updateCampaign(long id, Map<String, Object> body) {
        campaign(id);
        String status = text(body, "status", "running");
        if (!List.of("running", "scheduled", "paused", "government", "finished").contains(status)) {
            throw BusinessException.validationError("不支持的活动状态：" + status);
        }
        jdbc.update("UPDATE service_campaign SET status=? WHERE id=?", status, id);
        log("营销活动", "CAMP" + id, "活动状态更新为 " + status);
        return campaigns().stream()
                .filter(item -> String.valueOf(item.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    private Map<String, Object> campaign(long id) {
        return jdbc.query("SELECT * FROM service_campaign WHERE id=?", campaignMapper(), id).stream()
                .findFirst().orElseThrow(() -> BusinessException.notFound("活动不存在：" + id));
    }

    public List<Map<String, Object>> qualityAlerts() {
        return jdbc.query("SELECT * FROM service_quality_alert ORDER BY status='closed', id", qualityAlertMapper());
    }

    @Transactional
    public Map<String, Object> resolveQualityAlert(long id, Map<String, Object> body) {
        Map<String, Object> alert = jdbc.query("SELECT * FROM service_quality_alert WHERE id=?",
                        qualityAlertMapper(), id).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("质量预警不存在：" + id));
        String status = text(body, "status", "closed");
        if (!List.of("open", "processing", "closed").contains(status)) {
            throw BusinessException.validationError("不支持的预警状态：" + status);
        }
        if ("closed".equals(String.valueOf(alert.get("status")))) {
            throw new BusinessException(409, "该预警已关闭");
        }
        String note = required(body, "note", "请填写处置说明");
        jdbc.update("UPDATE service_quality_alert SET status=? WHERE id=?", status, id);
        log("质量预警", "QA" + id + " · " + alert.get("providerName"), "状态更新为 " + status + "；" + note);
        if (alert.get("providerId") != null) {
            notifyProvider(longValue(alert.get("providerId")), "质量预警处置结论",
                    "预警「" + alert.get("type") + "」处置结论：" + note);
        }
        return qualityAlerts().stream()
                .filter(item -> String.valueOf(item.get("id")).equals(String.valueOf(id)))
                .findFirst().orElseThrow();
    }

    public List<Map<String, Object>> strategies() {
        return jdbc.query("SELECT * FROM service_strategy ORDER BY config_key", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", rs.getString("config_key"));
            item.put("label", rs.getString("label"));
            item.put("value", rs.getString("value_text"));
            item.put("description", rs.getString("description"));
            item.put("updatedAt", rs.getString("updated_at"));
            return item;
        });
    }

    @Transactional
    public List<Map<String, Object>> updateStrategy(Map<String, Object> body) {
        String key = required(body, "key", "缺少策略参数标识");
        String value = required(body, "value", "请填写策略参数值");
        int updated = jdbc.update("UPDATE service_strategy SET value_text=?, updated_at=? WHERE config_key=?",
                value, LocalDateTime.now().format(DATE_TIME), key);
        if (updated == 0) {
            throw BusinessException.notFound("策略参数不存在：" + key);
        }
        log("匹配策略", key, "参数更新为 " + value);
        return strategies();
    }

    /**
     * 运营侧人员名单：这里只是"组织上设有哪几个岗位"。
     * 真实操作人一律从登录令牌写进 {@code service_op_log}，不拿岗位名顶。
     */
    public List<Map<String, Object>> team() {
        return jdbc.query("SELECT * FROM service_team_member ORDER BY id", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("role", rs.getString("role_name"));
            item.put("scope", rs.getString("scope_name"));
            item.put("permissions", split(rs.getString("permissions_text")));
            item.put("status", rs.getString("status"));
            return item;
        });
    }

    public List<Map<String, Object>> logs() {
        return jdbc.query("SELECT * FROM service_op_log ORDER BY id DESC LIMIT 200", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("operator", rs.getString("operator_name"));
            item.put("role", rs.getString("role_name"));
            item.put("action", rs.getString("action_name"));
            item.put("target", rs.getString("target_name"));
            item.put("detail", rs.getString("detail"));
            item.put("ip", rs.getString("ip_address"));
            item.put("createdAt", rs.getString("created_at"));
            return item;
        });
    }

    public Map<String, Object> report() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("trend", jdbc.query("SELECT * FROM service_daily_metric ORDER BY metric_date", dailyMapper()));
        result.put("categories", jdbc.query("""
                SELECT category, COUNT(*) order_count, SUM(total_amount) gmv,
                       ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END),2) avg_rating
                FROM service_order GROUP BY category ORDER BY gmv DESC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("category", rs.getString("category"));
            row.put("orderCount", rs.getLong("order_count"));
            row.put("gmv", rs.getBigDecimal("gmv") == null ? BigDecimal.ZERO : rs.getBigDecimal("gmv"));
            row.put("avgRating", rs.getBigDecimal("avg_rating") == null ? BigDecimal.ZERO : rs.getBigDecimal("avg_rating"));
            return row;
        }));
        result.put("providers", providers("available", null));
        // 原先运营"质量"卡片写死 99.62% / 186 / 42 这类常量，这里全部按表实算
        result.put("complaintRate", decimalValue("""
                SELECT ROUND(COALESCE(
                  (SELECT COUNT(*) FROM service_complaint) * 100.0
                  / NULLIF((SELECT COUNT(*) FROM service_order), 0), 0), 2)
                """));
        result.put("avgRating", decimalValue(
                "SELECT COALESCE(ROUND(AVG(rating),2),0) FROM service_order WHERE rating IS NOT NULL"));
        result.put("openAlerts", number("SELECT COUNT(*) FROM service_quality_alert WHERE status<>'closed'"));
        return result;
    }

    /* ==================== 服务商移动工作台（身份由令牌解析） ==================== */

    /** 当前登录服务商的工作台；providerId 由 {@code service_provider.merchant_id} 解析，不接受前端传号。 */
    public Map<String, Object> mobileWorkbench() {
        long providerId = identity.currentProviderId();
        Map<String, Object> provider = provider(providerId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", provider);
        result.put("availableDemands", jdbc.query("""
                SELECT d.*, p.price quoted_price, p.unit quoted_unit
                FROM service_demand d
                JOIN service_provider p ON p.category=d.category AND p.id=?
                WHERE d.status='matching' AND d.accepted_provider_id IS NULL
                ORDER BY d.preferred_date
                """, (rs, rowNum) -> {
            Map<String, Object> item = demandMap(rs);
            item.put("quotedPrice", rs.getBigDecimal("quoted_price"));
            item.put("quotedUnit", rs.getString("quoted_unit"));
            // 未接单前不给联系方式：抢单池里的号码原先整表可见
            item.put("contactPhone", maskPhone(rs.getString("contact_phone")));
            return item;
        }, providerId));
        result.put("todayOrders", jdbc.query("""
                SELECT * FROM service_order WHERE provider_id=? AND status IN ('confirmed','in_progress')
                ORDER BY appointment_date, id
                """, orderMapper(), providerId));
        result.put("myOrders", number("SELECT COUNT(*) FROM service_order WHERE provider_id=?", providerId));
        result.put("completedOrders", number(
                "SELECT COUNT(*) FROM service_order WHERE provider_id=? AND status='completed'", providerId));
        result.put("openComplaints", number("""
                SELECT COUNT(*) FROM service_complaint c JOIN service_order o ON o.order_no=c.order_no
                WHERE o.provider_id=? AND c.status<>'resolved'
                """, providerId));
        return result;
    }

    @Transactional
    public Map<String, Object> acceptDemand(long demandId) {
        long providerId = identity.currentProviderId();
        Map<String, Object> provider = provider(providerId);
        if (!"available".equals(provider.get("status"))) {
            throw new BusinessException(409, "当前服务商不可接单（" + provider.get("status") + "）");
        }
        Map<String, Object> demand = demandRow(demandId);
        if (!String.valueOf(provider.get("category")).equals(String.valueOf(demand.get("category")))) {
            throw new BusinessException(409, "该需求属于「" + demand.get("category") + "」，不在你的服务类目内");
        }
        int updated = jdbc.update("""
                UPDATE service_demand
                SET status='accepted', accepted_provider_id=?, accepted_provider_name=?
                WHERE id=? AND status='matching' AND accepted_provider_id IS NULL
                """, providerId, provider.get("name"), demandId);
        if (updated == 0) {
            throw new BusinessException(409, "该需求已被接受或状态已变化");
        }
        BigDecimal quantity = parseQuantity(String.valueOf(demand.get("area")));
        BigDecimal unitPrice = (BigDecimal) provider.get("price");
        BigDecimal total = unitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        String orderNo = createWorkOrder(providerId, provider, demand, quantity, unitPrice, total, "mobile_accepted");
        log("移动端抢单", "DM" + demandId, provider.get("name") + " 已接单，生成工单 " + orderNo);
        notifyMerchant(demand, "需求已被接单",
                "需求 " + demand.get("demandNo") + " 已由「" + provider.get("name") + "」接单，工单号 " + orderNo
                        + "，请留意上门服务时间。");
        notifyProvider(providerId, "接单成功", "工单 " + orderNo + " 已生成，请在工作台上报服务进度。");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("demandId", String.valueOf(demandId));
        result.put("providerName", provider.get("name"));
        result.put("status", "accepted");
        result.put("orderNo", orderNo);
        return result;
    }

    /** 抢单与指派共用：工单的归属主体取需求发布方，不再落到某个固定服务商默认账号上。 */
    private String createWorkOrder(long providerId, Map<String, Object> provider, Map<String, Object> demand,
                                   BigDecimal quantity, BigDecimal unitPrice, BigDecimal total, String dispatchStatus) {
        String orderNo = serial("FW");
        BigDecimal deposit = total.multiply(new BigDecimal("0.2")).setScale(0, RoundingMode.HALF_UP);
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO service_order
                    (order_no,provider_id,provider_name,service_name,category,quantity,unit,unit_price,total_amount,
                     deposit_amount,appointment_date,location,contact_name,contact_phone,notes,status,progress,
                     dispatch_status,merchant_id,merchant_name)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'confirmed',35,?,?,?)
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setObject(1, orderNo);
            statement.setObject(2, providerId);
            statement.setObject(3, provider.get("name"));
            statement.setObject(4, demand.get("serviceName"));
            statement.setObject(5, demand.get("category"));
            statement.setObject(6, quantity);
            statement.setObject(7, "亩");
            statement.setObject(8, unitPrice);
            statement.setObject(9, total);
            statement.setObject(10, deposit);
            statement.setObject(11, demand.get("preferredDate"));
            statement.setObject(12, demand.get("location"));
            statement.setObject(13, demand.get("contactName"));
            statement.setObject(14, demand.get("contactPhone"));
            statement.setObject(15, demand.get("description"));
            statement.setObject(16, dispatchStatus);
            statement.setObject(17, demand.get("merchantId"));
            statement.setObject(18, demand.get("merchantName"));
            return statement;
        }, keyHolder);
        Number generated = keyHolder.getKey();
        long orderId = generated == null ? 0L : generated.longValue();
        jdbc.update("""
                INSERT INTO service_order_event (order_id,title,note,event_time,completed)
                VALUES (?, ?, ?, ?, TRUE)
                """, orderId, "dispatched".equals(dispatchStatus) ? "运营指派需求" : "服务商已接单",
                provider.get("name") + ("dispatched".equals(dispatchStatus) ? " 已承接该需求" : " 已接受需求，等待上门服务"),
                LocalDateTime.now().format(DATE_TIME));
        return orderNo;
    }

    @Transactional
    public Map<String, Object> reportProgress(long orderId, Map<String, Object> body) {
        long providerId = identity.currentProviderId();
        Map<String, Object> order = jdbc.query("SELECT * FROM service_order WHERE id=? AND provider_id=?",
                        orderMapper(), orderId, providerId).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("工单不存在，或它不属于当前服务商"));
        int progress = intValue(body.get("progress"));
        if (progress < 0 || progress > 100) {
            throw BusinessException.validationError("进度必须在 0-100 之间");
        }
        String status = String.valueOf(order.get("status"));
        if (List.of("completed", "cancelled").contains(status)) {
            throw new BusinessException(409, "工单已" + ("completed".equals(status) ? "完成" : "取消") + "，不能再上报进度");
        }
        int previous = intValue(order.get("progress"));
        if (progress < previous) {
            throw new BusinessException(409, "进度不能回退（当前 " + previous + "%）");
        }
        String next = progress >= 100 ? "completed" : "in_progress";
        jdbc.update("UPDATE service_order SET progress=?,status=? WHERE id=?", progress, next, orderId);
        String note = text(body, "note", "已完成 " + progress + "%");
        jdbc.update("""
                INSERT INTO service_order_event (order_id,title,note,event_time,completed)
                VALUES (?, ?, ?, ?, TRUE)
                """, orderId, "服务商上报进度", note, LocalDateTime.now().format(DATE_TIME));
        log("服务进度上报", String.valueOf(order.get("orderNo")), "进度 " + progress + "%；" + note);
        notifyMerchant(order, "completed".equals(next) ? "服务已完成，待你验收" : "服务进度更新",
                "工单 " + order.get("orderNo") + "：" + note
                        + ("completed".equals(next) ? "。请确认验收，验收后可评价。" : ""));
        return mobileWorkbench();
    }

    /* ==================== 内部工具 ==================== */

    private Map<String, Object> demandRow(long demandId) {
        return jdbc.query("SELECT * FROM service_demand WHERE id=?", (rs, rowNum) -> demandMap(rs), demandId)
                .stream().findFirst().orElseThrow(() -> BusinessException.notFound("需求不存在：" + demandId));
    }

    /** 私域单据的收件人：主体号取行上已有的列；没有归属就不发（不把业务动作报错）。 */
    private void notifyMerchant(Map<String, Object> row, String title, String content) {
        Object merchantId = row.get("merchantId");
        if (merchantId == null || "null".equals(String.valueOf(merchantId))) {
            return;
        }
        String bizNo = firstNonBlank(row, "orderNo", "demandNo", "applicationNo", "claimNo", "complaintNo");
        serviceRepository.notify(Long.parseLong(String.valueOf(merchantId)),
                String.valueOf(row.get("merchantName")), "order", title, content, null, bizNo);
    }

    /** 服务商侧通知：收件人取档案绑定的经营主体；没绑定就只留操作日志，不发给别家。 */
    private void notifyProvider(long providerId, String title, String content) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT merchant_id,name FROM service_provider WHERE id=?", providerId);
        if (rows.isEmpty() || rows.get(0).get("merchant_id") == null) {
            return;
        }
        long merchantId = ((Number) rows.get(0).get("merchant_id")).longValue();
        serviceRepository.notify(merchantId, String.valueOf(rows.get(0).get("name")), "provider",
                title, content, "PROVIDER", String.valueOf(providerId));
    }

    private String firstNonBlank(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value != null && !String.valueOf(value).isBlank() && !"null".equals(String.valueOf(value))) {
                return String.valueOf(value);
            }
        }
        return "";
    }

    /**
     * 操作留痕：操作人与角色来自登录令牌，来源 IP 取真实请求地址。
     *
     * <p>原先这里固定写"王运营 / 127.0.0.1"，谁做的、从哪儿做的都查不到，
     * 这条审计记录出事时只会误导排查。</p>
     */
    private void log(String action, String target, String detail) {
        jdbc.update("""
                INSERT INTO service_op_log
                (operator_name,role_name,action_name,target_name,detail,ip_address,created_at)
                VALUES (?,?,?,?,?,?,?)
                """, identity.requireOperatorName(), identity.operatorRole(), action, target, detail,
                identity.clientIp(), LocalDateTime.now().format(DATE_TIME));
    }

    private RowMapper<Map<String, Object>> providerMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("categoryIcon", rs.getString("category_icon"));
            item.put("rating", rs.getBigDecimal("rating"));
            item.put("orderCount", rs.getInt("order_count"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("unit", rs.getString("unit"));
            item.put("badge", rs.getString("badge"));
            item.put("region", rs.getString("region"));
            item.put("status", rs.getString("status"));
            item.put("creditCode", rs.getString("credit_code"));
            item.put("contactName", rs.getString("contact_name"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("serviceArea", rs.getString("service_area"));
            item.put("creditScore", rs.getInt("credit_score"));
            item.put("cancelRate", rs.getBigDecimal("cancel_rate"));
            item.put("riskLevel", rs.getString("risk_level"));
            item.put("auditReason", rs.getString("audit_reason"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("createdAt", rs.getString("created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> serviceItemMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("providerId", String.valueOf(rs.getLong("provider_id")));
            item.put("providerName", rs.getString("provider_name"));
            item.put("providerRegion", rs.getString("provider_region"));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("unit", rs.getString("unit"));
            item.put("description", rs.getString("description"));
            item.put("selectedCount", rs.getInt("selected_count"));
            item.put("status", rs.getString("status"));
            item.put("auditStatus", rs.getString("audit_status"));
            item.put("auditReason", rs.getString("audit_reason"));
            item.put("aiScore", rs.getInt("ai_score"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> orderMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("orderNo", rs.getString("order_no"));
            item.put("providerId", String.valueOf(rs.getLong("provider_id")));
            item.put("providerName", rs.getString("provider_name"));
            item.put("serviceName", rs.getString("service_name"));
            item.put("category", rs.getString("category"));
            item.put("quantity", rs.getBigDecimal("quantity"));
            item.put("unit", rs.getString("unit"));
            item.put("totalAmount", rs.getBigDecimal("total_amount"));
            item.put("appointmentDate", rs.getString("appointment_date"));
            item.put("location", rs.getString("location"));
            item.put("contactName", rs.getString("contact_name"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("dispatchStatus", rs.getString("dispatch_status"));
            item.put("riskFlag", rs.getString("risk_flag"));
            item.put("settleStatus", rs.getString("settle_status"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("merchantName", rs.getString("merchant_name"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> applicationMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("applicationNo", rs.getString("application_no"));
            item.put("policyTitle", rs.getString("policy_title"));
            item.put("applicant", rs.getString("applicant"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("amountText", rs.getString("amount_text"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("merchantName", rs.getString("merchant_name"));
            item.put("submittedAt", formatTimestamp(rs, "submitted_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> complaintMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("complaintNo", rs.getString("complaint_no"));
            item.put("orderNo", rs.getString("order_no"));
            item.put("category", rs.getString("category"));
            item.put("description", rs.getString("description"));
            item.put("demand", rs.getString("demand"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("handler", rs.getString("handler"));
            item.put("resolution", rs.getString("resolution"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("merchantName", rs.getString("merchant_name"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> claimMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("claimNo", rs.getString("claim_no"));
            item.put("policyNo", rs.getString("policy_no"));
            item.put("disasterType", rs.getString("disaster_type"));
            item.put("description", rs.getString("description"));
            item.put("lossArea", rs.getString("loss_area"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("merchantName", rs.getString("merchant_name"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> settlementMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("batchNo", rs.getString("batch_no"));
            item.put("period", rs.getString("period_name"));
            item.put("orderCount", rs.getInt("order_count"));
            item.put("amount", rs.getBigDecimal("amount"));
            item.put("commission", rs.getBigDecimal("commission"));
            item.put("status", rs.getString("status"));
            item.put("reviewedBy", rs.getString("reviewed_by"));
            item.put("reviewedAt", rs.getString("reviewed_at"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> campaignMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("scope", rs.getString("scope_name"));
            item.put("quota", rs.getInt("quota"));
            item.put("claimed", rs.getInt("claimed"));
            item.put("budget", rs.getBigDecimal("budget"));
            item.put("status", rs.getString("status"));
            item.put("startsAt", rs.getString("starts_at"));
            item.put("endsAt", rs.getString("ends_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> qualityAlertMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("providerId", rs.getObject("provider_id") == null ? null : String.valueOf(rs.getLong("provider_id")));
            item.put("providerName", rs.getString("provider_name"));
            item.put("type", rs.getString("alert_type"));
            item.put("content", rs.getString("content"));
            item.put("score", rs.getBigDecimal("score"));
            item.put("level", rs.getString("level"));
            item.put("status", rs.getString("status"));
            item.put("createdAt", rs.getString("created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> dailyMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", rs.getString("metric_date"));
            item.put("orders", rs.getInt("order_count"));
            item.put("gmv", rs.getBigDecimal("gmv"));
            item.put("providers", rs.getInt("provider_count"));
            item.put("complaints", rs.getInt("complaint_count"));
            return item;
        };
    }

    private Map<String, Object> demandMap(java.sql.ResultSet rs) {
        try {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("demandNo", rs.getString("demand_no"));
            item.put("category", rs.getString("category"));
            item.put("serviceName", rs.getString("service_name"));
            item.put("description", rs.getString("description"));
            item.put("location", rs.getString("location"));
            item.put("area", rs.getString("area"));
            item.put("preferredDate", rs.getString("preferred_date"));
            item.put("budgetMin", rs.getBigDecimal("budget_min"));
            item.put("budgetMax", rs.getBigDecimal("budget_max"));
            item.put("contactName", rs.getString("contact_name"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("status", rs.getString("status"));
            item.put("matchCount", rs.getInt("match_count"));
            item.put("acceptedProviderId", rs.getObject("accepted_provider_id") == null
                    ? null : String.valueOf(rs.getLong("accepted_provider_id")));
            item.put("acceptedProviderName", rs.getString("accepted_provider_name"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("merchantName", rs.getString("merchant_name"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        } catch (java.sql.SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Map<String, Object> todo(String route, String title, Object count, String description) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("route", route);
        item.put("title", title);
        item.put("count", count);
        item.put("description", description);
        return item;
    }

    private long number(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    private BigDecimal decimalValue(String sql, Object... args) {
        BigDecimal value = jdbc.queryForObject(sql, BigDecimal.class, args);
        return value == null ? BigDecimal.ZERO : value;
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) {
            throw BusinessException.validationError(message);
        }
        return value;
    }

    private long requiredLong(Object value, String message) {
        if (value == null || String.valueOf(value).isBlank()) {
            throw BusinessException.validationError(message);
        }
        return parseLongOrThrow(String.valueOf(value).trim(), message);
    }

    private long parseLongOrThrow(String value, String message) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            throw BusinessException.validationError(message);
        }
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private String like(String value) {
        return "%" + value.toLowerCase(Locale.ROOT) + "%";
    }

    private String maskPhone(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (value.contains("*")) {
            return value;
        }
        String digits = value.trim();
        if (digits.length() < 7) {
            return digits;
        }
        return digits.substring(0, 3) + "****" + digits.substring(digits.length() - 4);
    }

    private List<String> split(String value) {
        List<String> values = new ArrayList<>();
        if (value == null || value.isBlank()) {
            return values;
        }
        for (String part : value.split(",")) {
            if (!part.isBlank()) {
                values.add(part.trim());
            }
        }
        return values;
    }

    private long longValue(Object value) {
        if (value == null || "null".equals(String.valueOf(value))) {
            return 0L;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private int intValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private String formatTimestamp(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        java.sql.Timestamp value = rs.getTimestamp(column);
        return value == null ? "" : value.toLocalDateTime().format(DATE_TIME);
    }

    private String serial(String prefix) {
        long sequence = Math.floorMod(SERIAL.incrementAndGet(), 1000);
        return prefix + LocalDateTime.now().format(SERIAL_TIME) + String.format("%03d", sequence);
    }
}
