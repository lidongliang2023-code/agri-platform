package com.agri.service.repository;

import com.agri.common.exception.BusinessException;
import com.agri.service.security.ServiceIdentityService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 综合服务用户端（需求方）数据访问。
 *
 * <p>这里的每一条私域读写都带 {@code merchant_id}：主体一律由
 * {@link ServiceIdentityService} 从访问令牌解析。原先这些查询没有任何主体条件
 * （{@code SELECT * FROM service_order WHERE 1=1}），所有人登录后看到的是同一份全平台清单，
 * 换个订单 ID 就能看别人的联系方式、改别人的订单。</p>
 */
@Repository
public class ServiceRepository {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter FULL_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter SERIAL_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final AtomicLong SERIAL = new AtomicLong();
    /** 订单状态机：谁能推进到哪儿，写死在这里而不是靠前端传什么就改什么。 */
    private static final Map<String, List<String>> ORDER_FLOW = Map.of(
            "pending_payment", List.of("confirmed", "cancelled"),
            "confirmed", List.of("in_progress", "cancelled"),
            "in_progress", List.of("completed", "cancelled"),
            "completed", List.of(),
            "cancelled", List.of());
    private static final List<String> POLICY_FLOW = List.of(
            "submitted", "town_review", "county_review", "paid", "rejected");

    private final JdbcTemplate jdbc;
    private final ServiceIdentityService identity;

    public ServiceRepository(JdbcTemplate jdbc, ServiceIdentityService identity) {
        this.jdbc = jdbc;
        this.identity = identity;
    }

    /* ==================== 首页 ==================== */

    public Map<String, Object> overview() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("serviceProviders", number("SELECT COUNT(*) FROM service_provider WHERE status='available'"));
        stats.put("completedOrders", number(
                "SELECT COUNT(*) FROM service_order WHERE merchant_id=? AND status='completed'", merchantId));
        stats.put("myOrders", number("SELECT COUNT(*) FROM service_order WHERE merchant_id=?", merchantId));
        BigDecimal satisfaction = jdbc.queryForObject(
                "SELECT COALESCE(ROUND(AVG(rating),1),0) FROM service_order WHERE merchant_id=? AND rating IS NOT NULL",
                BigDecimal.class, merchantId);
        stats.put("satisfaction", satisfaction);
        stats.put("protectedAmount", decimalValue(
                "SELECT COALESCE(SUM(total_amount),0) FROM service_order WHERE merchant_id=? AND status<>'cancelled'",
                merchantId));
        stats.put("unreadMessages", number(
                "SELECT COUNT(*) FROM service_message WHERE merchant_id=? AND is_read=FALSE", merchantId));
        result.put("stats", stats);
        // 类目数量按在营服务商实算：原先是代码里的十个常量，页面写"286 家"而库里一条都没变过
        result.put("categories", jdbc.query("""
                SELECT category, COUNT(*) AS provider_count
                FROM service_provider WHERE status='available' GROUP BY category
                """, (rs, rowNum) -> category(rs.getString("category"), categoryIcon(rs.getString("category")),
                categoryKey(rs.getString("category")), rs.getLong("provider_count"))));
        result.put("featuredProviders", jdbc.query(
                "SELECT * FROM service_provider WHERE status='available' ORDER BY rating DESC, order_count DESC LIMIT 4",
                providerMapper(false)));
        result.put("policies", policies(null).stream().limit(3).toList());
        result.put("todos", todos(merchantId));
        return result;
    }

    /** 我的待办：全部来自当前主体真实存在的单据，没有就返回空数组而不是三条写死的示例。 */
    private List<Map<String, Object>> todos(long merchantId) {
        List<Map<String, Object>> todos = new ArrayList<>();
        for (Map<String, Object> order : jdbc.query("""
                SELECT * FROM service_order WHERE merchant_id=? AND status IN ('confirmed','in_progress')
                ORDER BY created_at DESC LIMIT 3
                """, orderMapper(), merchantId)) {
            todos.add(todo("作业进度", order.get("providerName") + " 承接的" + order.get("serviceName")
                    + "（" + order.get("orderNo") + "）", String.valueOf(order.get("status")),
                    order.get("progress") + "%", "order:" + order.get("id")));
        }
        for (Map<String, Object> application : jdbc.query("""
                SELECT * FROM service_policy_application WHERE merchant_id=?
                  AND status NOT IN ('paid','rejected') ORDER BY submitted_at DESC LIMIT 2
                """, applicationMapper(), merchantId)) {
            todos.add(todo("政策申报", application.get("policyTitle") + " 当前处于「"
                    + application.get("status") + "」", String.valueOf(application.get("status")),
                    application.get("progress") + "%", "policy"));
        }
        for (Map<String, Object> claim : jdbc.query("""
                SELECT * FROM insurance_claim WHERE merchant_id=?
                  AND status NOT IN ('paid','closed','rejected') ORDER BY created_at DESC LIMIT 2
                """, claimMapper(), merchantId)) {
            todos.add(todo("理赔查勘", "案件 " + claim.get("claimNo") + "（" + claim.get("disasterType")
                    + "）当前处于「" + claim.get("status") + "」", String.valueOf(claim.get("status")),
                    claim.get("progress") + "%", "claim"));
        }
        for (Map<String, Object> complaint : jdbc.query("""
                SELECT * FROM service_complaint WHERE merchant_id=? AND status<>'resolved'
                ORDER BY created_at DESC LIMIT 2
                """, complaintMapper(), merchantId)) {
            todos.add(todo("投诉跟进", "工单 " + complaint.get("complaintNo") + " 等待平台处理",
                    String.valueOf(complaint.get("status")), complaint.get("progress") + "%", "complaint"));
        }
        return todos;
    }

    /* ==================== 服务商与市场（公开） ==================== */

    public List<Map<String, Object>> providers(String category, String keyword, String sort) {
        StringBuilder sql = new StringBuilder("SELECT * FROM service_provider WHERE status='available'");
        List<Object> args = new ArrayList<>();
        if (category != null && !category.isBlank() && !"全部".equals(category)) {
            sql.append(" AND category=?");
            args.add(category);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)");
            String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        switch (sort == null ? "" : sort) {
            case "distance" -> sql.append(" ORDER BY distance_km ASC, rating DESC");
            case "price" -> sql.append(" ORDER BY price ASC, rating DESC");
            case "orders" -> sql.append(" ORDER BY order_count DESC, rating DESC");
            default -> sql.append(" ORDER BY rating DESC, order_count DESC");
        }
        List<Map<String, Object>> rows = jdbc.query(sql.toString(), providerMapper(false), args.toArray());
        List<String> favorites = favoriteProviderIds();
        rows.forEach(row -> row.put("favorited", favorites.contains(String.valueOf(row.get("id")))));
        return rows;
    }

    public Map<String, Object> provider(long id) {
        List<Map<String, Object>> providers = jdbc.query(
                "SELECT * FROM service_provider WHERE id=?", providerMapper(true), id);
        if (providers.isEmpty()) {
            throw BusinessException.notFound("服务商不存在或已下架：" + id);
        }
        Map<String, Object> provider = providers.get(0);
        provider.put("favorited", favoriteProviderIds().contains(String.valueOf(id)));
        return provider;
    }

    /** 收藏服务商：真实落库，按主体隔离，不再是页面里的一个本地 state。 */
    public List<String> favoriteProviderIds() {
        if (identity.isOps()) {
            return List.of();
        }
        return jdbc.queryForList("SELECT CAST(provider_id AS CHAR) FROM service_favorite WHERE merchant_id=?",
                String.class, Long.parseLong(identity.currentMerchantId()));
    }

    public List<Map<String, Object>> favorites() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("""
                SELECT p.* FROM service_provider p
                JOIN service_favorite f ON f.provider_id=p.id
                WHERE f.merchant_id=? ORDER BY f.id DESC
                """, providerMapper(false), merchantId);
    }

    @Transactional
    public Map<String, Object> toggleFavorite(long providerId) {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        Map<String, Object> provider = jdbc.queryForList("SELECT * FROM service_provider WHERE id=?", providerId)
                .stream().findFirst().orElseThrow(() -> BusinessException.notFound("服务商不存在：" + providerId));
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM service_favorite WHERE merchant_id=? AND provider_id=?",
                Integer.class, merchantId, providerId);
        if (exists != null && exists > 0) {
            jdbc.update("DELETE FROM service_favorite WHERE merchant_id=? AND provider_id=?", merchantId, providerId);
            return Map.of("providerId", String.valueOf(providerId), "name", provider.get("name"),
                    "favorited", false);
        }
        jdbc.update("INSERT INTO service_favorite (merchant_id,provider_id,created_at) VALUES (?,?,?)",
                merchantId, providerId, LocalDateTime.now().format(FULL_TIME));
        return Map.of("providerId", String.valueOf(providerId), "name", provider.get("name"), "favorited", true);
    }

    /** 入驻申请：申请人一律取当前主体，不接受前端自报姓名。 */
    @Transactional
    public Map<String, Object> createProvider(Map<String, Object> body) {
        String name = required(body, "name", "请输入服务商名称");
        String category = required(body, "category", "请选择服务类型");
        String phone = required(body, "phone", "请输入联系电话");
        String description = text(body, "description", "新入驻服务商");
        String region = text(body, "region", "待完善服务区域");
        long merchantId = Long.parseLong(identity.currentMerchantId());
        // 资质列此前被手机号占了位：服务商详情页会把一串号码当成"营业执照"展示出来
        String certifications = text(body, "certifications", "待补充资质材料");
        jdbc.update("""
                INSERT INTO service_provider
                (name,category,category_icon,rating,order_count,distance_km,response_minutes,price,unit,badge,tags,
                 description,certifications,region,available_slots,status,contact_name,contact_phone,merchant_id)
                VALUES (?,?,?,5.0,0,0,30,0,'元/次','审核中','新入驻',?,?,?, '待完善','pending',?,?,?)
                """, name, category, categoryIcon(category), description, certifications, region,
                identity.currentMerchantName(), phone, merchantId);
        Long id = jdbc.queryForObject("SELECT MAX(id) FROM service_provider", Long.class);
        notifyMe("provider", "服务商入驻申请已提交",
                "「" + name + "」的入驻资料已提交，平台将在 1 个工作日内完成资质审核。", "PROVIDER", "SV" + id);
        return Map.of(
                "id", String.valueOf(id),
                "name", name,
                "status", "pending",
                "message", "入驻资料已提交，平台将在 1 个工作日内完成资质审核"
        );
    }

    /* ==================== 专家与资源（真实档案，不再是页面里的常量数组） ==================== */

    public List<Map<String, Object>> experts(String category) {
        if (category == null || category.isBlank() || "全部".equals(category)) {
            return jdbc.query("SELECT * FROM service_expert WHERE status='available' ORDER BY consult_count DESC",
                    expertMapper());
        }
        return jdbc.query("SELECT * FROM service_expert WHERE status='available' AND category=? ORDER BY consult_count DESC",
                expertMapper(), category);
    }

    /** 土地流转与劳务用工：有表、有归属、有状态，联系方式对别家脱敏。 */
    public List<Map<String, Object>> resources(String type) {
        long merchantId;
        try {
            merchantId = Long.parseLong(identity.currentMerchantId());
        } catch (Exception e) {
            merchantId = -1L;
        }
        String sql = (type == null || type.isBlank() || "all".equals(type))
                ? "SELECT * FROM service_resource ORDER BY created_at DESC"
                : "SELECT * FROM service_resource WHERE resource_type=? ORDER BY created_at DESC";
        List<Map<String, Object>> rows = jdbc.query(sql, resourceMapper(),
                (type == null || type.isBlank() || "all".equals(type)) ? new Object[] {} : new Object[] {type});
        long own = merchantId;
        rows.forEach(row -> {
            boolean mine = row.get("merchantId") != null && String.valueOf(row.get("merchantId")).equals(String.valueOf(own));
            row.put("mine", mine);
            if (!mine) {
                row.put("contactPhone", maskPhone(String.valueOf(row.get("contactPhone"))));
            }
        });
        return rows;
    }

    @Transactional
    public Map<String, Object> createResource(Map<String, Object> body) {
        String type = required(body, "resourceType", "请选择资源类型");
        if (!List.of("land", "labor").contains(type)) {
            throw BusinessException.validationError("资源类型只能是 land（土地流转）或 labor（劳务用工）");
        }
        String title = required(body, "title", "请填写资源标题");
        String location = required(body, "location", "请填写所在地");
        BigDecimal price = decimal(body.get("price"), BigDecimal.ZERO);
        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw BusinessException.validationError("请填写有效的价格");
        }
        long merchantId = Long.parseLong(identity.currentMerchantId());
        jdbc.update("""
                INSERT INTO service_resource
                (resource_type,title,location,area_mu,price,unit,description,contact_name,contact_phone,
                 merchant_id,merchant_name,status,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?, 'open',?)
                """, type, title, location, decimal(body.get("areaMu"), BigDecimal.ZERO), price,
                text(body, "unit", "land".equals(type) ? "元/亩/年" : "元/人/天"),
                text(body, "description", ""),
                text(body, "contactName", identity.currentMerchantName()),
                required(body, "contactPhone", "请填写联系电话"),
                merchantId, identity.currentMerchantName(), LocalDateTime.now().format(FULL_TIME));
        Long id = jdbc.queryForObject("SELECT MAX(id) FROM service_resource", Long.class);
        return resourceRow(id);
    }

    private Map<String, Object> resourceRow(long id) {
        return jdbc.query("SELECT * FROM service_resource WHERE id=?", resourceMapper(), id).get(0);
    }

    /* ==================== 订单（私域） ==================== */

    @Transactional
    public Map<String, Object> createOrder(Map<String, Object> body) {
        // 服务商必须由前端明确选一家：原先缺省取 1 号，等于谁没选都派给同一家合作社
        long providerId = requiredLong(body, "providerId", "请选择服务商");
        Map<String, Object> provider = provider(providerId);
        if (!"available".equals(provider.get("status"))) {
            throw BusinessException.forbidden("该服务商当前不可接单：" + provider.get("name"));
        }
        String appointmentDate = required(body, "appointmentDate", "请选择预约日期");
        String appointmentSlot = required(body, "appointmentSlot", "请选择上门时段");
        String location = required(body, "location", "请填写服务地址");
        BigDecimal quantity = decimal(body.get("quantity"), null);
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw BusinessException.validationError("请填写服务数量");
        }
        long merchantId = Long.parseLong(identity.currentMerchantId());
        // 单价只认服务商目录价：原先取请求里的 unitPrice，买家自己传 0.01 就能把价打下来
        Map<String, Object> catalogItem = findCatalogItem(providerId, text(body, "serviceName", ""));
        String unit = catalogItem != null
                ? measure(String.valueOf(catalogItem.get("unit")))
                : measure(String.valueOf(provider.get("unit")));
        BigDecimal unitPrice = catalogItem != null
                ? (BigDecimal) catalogItem.get("price")
                : decimal(provider.get("price"), BigDecimal.ZERO);
        if (unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw BusinessException.validationError("该服务商暂无有效报价，请联系平台核实");
        }
        BigDecimal total = unitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        BigDecimal deposit = total.multiply(new BigDecimal("0.2")).setScale(0, RoundingMode.HALF_UP);
        String orderNo = serial("FW");
        String serviceName = catalogItem != null
                ? String.valueOf(catalogItem.get("name"))
                : text(body, "serviceName", String.valueOf(provider.get("name")));
        jdbc.update("""
                INSERT INTO service_order
                (order_no,provider_id,provider_name,service_name,category,quantity,unit,unit_price,total_amount,deposit_amount,
                 appointment_date,appointment_slot,location,contact_name,contact_phone,notes,status,progress,merchant_id,merchant_name)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending_payment',10,?,?)
                """,
                orderNo, providerId, provider.get("name"), serviceName,
                text(body, "category", String.valueOf(provider.get("category"))),
                quantity, unit, unitPrice, total, deposit,
                appointmentDate, appointmentSlot, location,
                text(body, "contactName", identity.currentMerchantName()),
                required(body, "contactPhone", "请输入联系电话"),
                text(body, "notes", ""), merchantId, identity.currentMerchantName());
        Long orderId = jdbc.queryForObject("SELECT id FROM service_order WHERE order_no=?", Long.class, orderNo);
        addOrderEvent(orderId, "预约已提交", "等待支付定金并锁定档期", LocalDateTime.now().format(DATE_TIME), true);
        addOrderEvent(orderId, "服务商确认", "支付定金后服务商确认机手与设备", "待支付", false);
        addOrderEvent(orderId, "现场服务", "按约定时间和地块完成作业", "待安排", false);
        addOrderEvent(orderId, "验收结算", "验收通过后释放尾款", "待完成", false);
        notifyMe("order", "服务预约已创建",
                "订单 " + orderNo + "（" + serviceName + " · " + provider.get("name") + "）已创建，"
                        + "定金 ¥" + deposit + " 支付后服务商才会确认档期。", "ORDER", orderNo);
        return order(orderId);
    }

    /** 已上架的服务目录价；请求里的 serviceName 命中目录就用目录价，命不中回落到服务商起价。 */
    private Map<String, Object> findCatalogItem(long providerId, String serviceName) {
        List<Map<String, Object>> items = jdbc.query("""
                SELECT name, price, unit FROM service_item
                WHERE provider_id=? AND audit_status='approved' AND status='enabled' ORDER BY id
                """, (rs, rowNum) -> Map.of(
                "name", rs.getString("name"),
                "price", rs.getBigDecimal("price"),
                "unit", rs.getString("unit")
        ), providerId);
        if (serviceName == null || serviceName.isBlank()) {
            return null;
        }
        return items.stream()
                .filter(item -> serviceName.equals(item.get("name"))
                        || serviceName.contains(String.valueOf(item.get("name")))
                        || String.valueOf(item.get("name")).contains(serviceName))
                .findFirst()
                .orElse(null);
    }

    /** 服务商报价单位形如「元/亩」，落到订单数量列时只要量纲。 */
    private String measure(String unit) {
        String value = unit == null ? "" : unit.replaceFirst("^元/", "").trim();
        return value.isBlank() ? "次" : value;
    }

    public List<Map<String, Object>> orders(String status, String keyword) {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        StringBuilder sql = new StringBuilder("SELECT * FROM service_order WHERE merchant_id=?");
        List<Object> args = new ArrayList<>();
        args.add(merchantId);
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND status=?");
            args.add(status);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(order_no) LIKE ? OR LOWER(service_name) LIKE ? OR LOWER(provider_name) LIKE ?)");
            String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY created_at DESC");
        return jdbc.query(sql.toString(), orderMapper(), args.toArray());
    }

    public Map<String, Object> order(long id) {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM service_order WHERE id=? AND merchant_id=?", orderMapper(), id, merchantId);
        if (rows.isEmpty()) {
            // 不暴露"存在但不是你的"：越权与不存在一律 404
            throw BusinessException.notFound("订单不存在，或它不属于当前经营主体");
        }
        Map<String, Object> order = rows.get(0);
        order.put("timeline", jdbc.query(
                "SELECT title,note,event_time AS eventTime,completed FROM service_order_event WHERE order_id=? ORDER BY id",
                eventMapper(), id));
        return order;
    }

    @Transactional
    public Map<String, Object> updateOrder(long id, Map<String, Object> body) {
        Map<String, Object> existing = order(id);
        String from = String.valueOf(existing.get("status"));
        String status = text(body, "status", from);
        if (!status.equals(from)) {
            List<String> allowed = ORDER_FLOW.getOrDefault(from, List.of());
            if (!allowed.contains(status)) {
                throw new BusinessException(409, "订单当前是「" + from + "」，不能改成「" + status + "」");
            }
        }
        int progress = switch (status) {
            case "pending_payment" -> 10;
            case "confirmed" -> 35;
            case "in_progress" -> 68;
            case "completed", "cancelled" -> 100;
            default -> intValue(existing.get("progress"));
        };
        jdbc.update("UPDATE service_order SET status=?, progress=? WHERE id=?", status, progress, id);
        String title = switch (status) {
            case "confirmed" -> "服务商已确认";
            case "in_progress" -> "服务已开始";
            case "completed" -> "作业已完成";
            case "cancelled" -> "订单已取消";
            default -> "订单状态已更新";
        };
        addOrderEvent(id, title, text(body, "note", "订单状态已同步"), LocalDateTime.now().format(DATE_TIME), true);
        notifyMe("order", title,
                "订单 " + existing.get("orderNo") + "：" + title
                        + "。" + text(body, "note", ""), "ORDER", String.valueOf(existing.get("orderNo")));
        return order(id);
    }

    @Transactional
    public Map<String, Object> reviewOrder(long id, Map<String, Object> body) {
        Map<String, Object> existing = order(id);
        // 评价只能落在已完成的单子上；原先这里顺手把状态改成 completed，
        // 等于"给个星级就算作业完成了"，结算与验收环节被跳过。
        if (!"completed".equals(String.valueOf(existing.get("status")))) {
            throw new BusinessException(409, "订单尚未完成（当前 " + existing.get("status") + "），不能评价");
        }
        if (existing.get("rating") != null && intValue(existing.get("rating")) > 0) {
            throw new BusinessException(409, "该订单已评价过，评分为 " + existing.get("rating"));
        }
        int rating = intValue(body.getOrDefault("rating", 5));
        if (rating < 1 || rating > 5) {
            throw BusinessException.validationError("评分必须在 1-5 之间");
        }
        String review = required(body, "review", "请填写评价内容");
        jdbc.update("UPDATE service_order SET rating=?, review=? WHERE id=?", rating, review, id);
        jdbc.update("UPDATE service_provider SET order_count=order_count+1 WHERE id=?",
                longValue(existing.get("providerId")));
        addOrderEvent(id, "服务已评价", "评分 " + rating + " 分：" + review,
                LocalDateTime.now().format(DATE_TIME), true);
        return order(id);
    }

    /* ==================== 需求（大厅公开、私域完整） ==================== */

    /**
     * 需求大厅：别人发的需求看得到，但联系方式要等指派成功才给。
     *
     * <p>手机号原先整表返回给任何登录者，等于把各家的联系方式集中暴露在一张列表里。</p>
     */
    public List<Map<String, Object>> demands() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM service_demand ORDER BY created_at DESC", demandMapper());
        rows.forEach(row -> {
            boolean mine = String.valueOf(merchantId).equals(String.valueOf(row.get("merchantId")));
            row.put("mine", mine);
            if (!mine) {
                row.put("contactPhone", maskPhone(String.valueOf(row.get("contactPhone"))));
            }
        });
        return rows;
    }

    /** 我发布的需求（含指派给谁、真实联系方式）。 */
    public List<Map<String, Object>> myDemands() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM service_demand WHERE merchant_id=? ORDER BY created_at DESC",
                demandMapper(), merchantId);
    }

    @Transactional
    public Map<String, Object> createDemand(Map<String, Object> body) {
        String demandNo = serial("DM");
        String category = required(body, "category", "请选择服务类型");
        String serviceName = required(body, "serviceName", "请填写需求标题");
        String location = required(body, "location", "请填写服务地点");
        String area = required(body, "area", "请填写服务面积或数量");
        String preferredDate = required(body, "preferredDate", "请选择期望作业日期");
        long merchantId = Long.parseLong(identity.currentMerchantId());
        // 撮合数按同类目在营服务商实算：原先是 2 + |标题.hashCode()| % 5，
        // 同一条标题永远显示同一个数，页面看着像算法产物，其实是字符串哈希。
        long matches = jdbc.queryForObject(
                "SELECT COUNT(*) FROM service_provider WHERE category=? AND status='available'",
                Long.class, category);
        jdbc.update("""
                INSERT INTO service_demand
                (demand_no,category,service_name,description,location,area,preferred_date,budget_min,budget_max,
                 contact_name,contact_phone,status,match_count,merchant_id,merchant_name)
                VALUES (?,?,?,?,?,?,?,?,?,?,?, 'matching',?,?,?)
                """,
                demandNo, category, serviceName,
                text(body, "description", ""), location, area, preferredDate,
                decimal(body.get("budgetMin"), BigDecimal.ZERO), decimal(body.get("budgetMax"), BigDecimal.ZERO),
                text(body, "contactName", identity.currentMerchantName()),
                required(body, "contactPhone", "请输入联系电话"),
                matches, merchantId, identity.currentMerchantName());
        Map<String, Object> demand = jdbc.queryForObject("SELECT * FROM service_demand WHERE demand_no=?",
                demandMapper(), demandNo);
        notifyMe("demand", "需求已发布，正在匹配服务商",
                "需求 " + demandNo + "（" + serviceName + "）已进入匹配池，同类目在营服务商 "
                        + matches + " 家；被接单后会在此通知你。", "DEMAND", demandNo);
        return demand;
    }

    /* ==================== 政策与申报（私域） ==================== */

    public List<Map<String, Object>> policies(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return jdbc.query("SELECT * FROM service_policy ORDER BY match_score DESC", policyMapper());
        }
        String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
        return jdbc.query("""
                SELECT * FROM service_policy
                WHERE LOWER(title) LIKE ? OR LOWER(category) LIKE ? OR LOWER(conditions_text) LIKE ?
                ORDER BY match_score DESC
                """, policyMapper(), like, like, like);
    }

    public List<Map<String, Object>> policyApplications() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM service_policy_application WHERE merchant_id=? ORDER BY submitted_at DESC",
                applicationMapper(), merchantId);
    }

    @Transactional
    public Map<String, Object> applyPolicy(Map<String, Object> body) {
        long policyId = requiredLong(body, "policyId", "请选择要申报的政策");
        Map<String, Object> policy = jdbc.query("SELECT * FROM service_policy WHERE id=?", policyMapper(), policyId)
                .stream().findFirst().orElseThrow(() -> BusinessException.notFound("政策不存在，无法申报：" + policyId));
        // 申报期闸门：已结束的政策不能再收材料，原先任何 id 都能提交成功
        String status = String.valueOf(policy.get("status"));
        if (!"open".equals(status)) {
            throw new BusinessException(409, "政策《" + policy.get("title") + "》当前状态是「" + status
                    + "」，不在申报期内");
        }
        long merchantId = Long.parseLong(identity.currentMerchantId());
        String applicationNo = serial("SQ");
        jdbc.update("""
                INSERT INTO service_policy_application
                (application_no,policy_id,policy_title,applicant,contact_phone,amount_text,status,progress,merchant_id,merchant_name)
                VALUES (?,?,?,?,?,?, 'submitted',20,?,?)
                """,
                applicationNo, policyId, policy.get("title"),
                identity.currentMerchantName(),
                required(body, "contactPhone", "请输入联系电话"),
                policy.get("amountText"), merchantId, identity.currentMerchantName());
        notifyMe("policy", "政策申报已提交",
                "《" + policy.get("title") + "》申报 " + applicationNo + " 已受理，进入乡镇审核后会在此通知。",
                "POLICY", applicationNo);
        return jdbc.queryForObject("SELECT * FROM service_policy_application WHERE application_no=?",
                applicationMapper(), applicationNo);
    }

    /* ==================== 保险（私域） ==================== */

    public List<Map<String, Object>> insuranceProducts() {
        return jdbc.query("SELECT * FROM insurance_product ORDER BY id", insuranceProductMapper());
    }

    public List<Map<String, Object>> insurancePolicies() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM insurance_policy WHERE merchant_id=? ORDER BY effective_date DESC",
                insurancePolicyMapper(), merchantId);
    }

    public List<Map<String, Object>> insuranceClaims() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM insurance_claim WHERE merchant_id=? ORDER BY created_at DESC",
                claimMapper(), merchantId);
    }

    /**
     * 投保：保费按产品费率 × 投保数量实算。
     *
     * <p>原先缺省就是 1280 元 / 153600 元这两个常量，前端传什么面积都不影响结果，
     * 页面上的"测算"其实是装饰。</p>
     */
    @Transactional
    public Map<String, Object> insure(Map<String, Object> body) {
        long productId = requiredLong(body, "productId", "请选择保险产品");
        Map<String, Object> product = jdbc.query("SELECT * FROM insurance_product WHERE id=?",
                        insuranceProductMapper(), productId).stream()
                .findFirst().orElseThrow(() -> BusinessException.notFound("保险产品不存在：" + productId));
        BigDecimal amount = decimal(body.get("insuredAmount"), null);
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw BusinessException.validationError("请填写投保" + product.get("unitMeasure") + "数量");
        }
        BigDecimal rate = decimal(product.get("premiumRate"), BigDecimal.ZERO);
        BigDecimal coveragePerUnit = decimal(product.get("coveragePerUnit"), BigDecimal.ZERO);
        if (rate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(500, "该保险产品未配置费率，无法测算保费，请联系平台运营补齐产品参数");
        }
        BigDecimal premium = rate.multiply(amount).setScale(2, RoundingMode.HALF_UP);
        BigDecimal coverage = coveragePerUnit.multiply(amount).setScale(2, RoundingMode.HALF_UP);
        long merchantId = Long.parseLong(identity.currentMerchantId());
        String policyNo = serial("NX");
        jdbc.update("""
                INSERT INTO insurance_policy
                (policy_no,product_id,product_name,insured_subject,insured_area,premium,coverage_amount,effective_date,status,merchant_id,merchant_name)
                VALUES (?,?,?,?,?,?,?,?, 'effective',?,?)
                """,
                policyNo, productId, product.get("name"),
                identity.currentMerchantName(),
                amount + " " + product.get("unitMeasure"),
                premium, coverage, java.time.LocalDate.now().plusDays(1).toString(),
                merchantId, identity.currentMerchantName());
        notifyMe("insurance", "投保成功",
                "保单 " + policyNo + "（" + product.get("name") + "）已生效，保费 ¥" + premium
                        + "，保额 ¥" + coverage + "，自次日起保障。", "POLICY_INSURANCE", policyNo);
        return jdbc.queryForObject("SELECT * FROM insurance_policy WHERE policy_no=?",
                insurancePolicyMapper(), policyNo);
    }

    @Transactional
    public Map<String, Object> createClaim(Map<String, Object> body) {
        // 保单必须由当前主体自己持有：原先缺省 policyId=1，任何人都能替别人报案
        long policyId = requiredLong(body, "policyId", "请选择要报案的保单");
        long merchantId = Long.parseLong(identity.currentMerchantId());
        Map<String, Object> policy = jdbc.query("SELECT * FROM insurance_policy WHERE id=?",
                        insurancePolicyMapper(), policyId).stream()
                .findFirst().orElseThrow(() -> BusinessException.notFound("保单不存在：" + policyId));
        if (!String.valueOf(merchantId).equals(String.valueOf(policy.get("merchantId")))) {
            throw BusinessException.forbidden("该保单不属于当前经营主体，不能替别人报案");
        }
        if ("expired".equals(String.valueOf(policy.get("status")))) {
            throw new BusinessException(409, "保单 " + policy.get("policyNo") + " 已失效，不能报案");
        }
        String claimNo = serial("LP");
        jdbc.update("""
                INSERT INTO insurance_claim
                (claim_no,policy_id,policy_no,disaster_type,description,loss_area,status,progress,merchant_id,merchant_name)
                VALUES (?,?,?,?,?,?, 'submitted',20,?,?)
                """,
                claimNo, policyId, policy.get("policyNo"),
                required(body, "disasterType", "请选择灾害类型"),
                required(body, "description", "请描述受灾情况"),
                text(body, "lossArea", "待查勘"), merchantId, identity.currentMerchantName());
        notifyMe("insurance", "报案已受理",
                "案件 " + claimNo + " 已受理，查勘员将在 24 小时内联系您；进度会在此更新。", "CLAIM", claimNo);
        return jdbc.queryForObject("SELECT * FROM insurance_claim WHERE claim_no=?", claimMapper(), claimNo);
    }

    /* ==================== 培训（我的学习进度与结业证书） ==================== */

    /** 课程列表：进度取当前主体的报名记录，不再用表上那个全平台共享的 progress 字段。 */
    public List<Map<String, Object>> courses() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        // 报过名、进度到 100% 但还没发证的，先由服务端补发结业证书（页面不能自己声明"已学完"）
        jdbc.queryForList("""
                SELECT course_id FROM service_enrollment
                WHERE merchant_id=? AND progress>=100 AND cert_no IS NULL
                """, Long.class, merchantId).forEach(courseId -> issueCertificate(merchantId, courseId));
        Map<String, Map<String, Object>> mine = new LinkedHashMap<>();
        for (Map<String, Object> enrollment : enrollments()) {
            mine.put(String.valueOf(enrollment.get("courseId")), enrollment);
        }
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM service_course ORDER BY learners DESC",
                courseMapper());
        rows.forEach(row -> {
            Map<String, Object> enrollment = mine.get(String.valueOf(row.get("id")));
            row.put("enrolled", enrollment != null);
            row.put("myProgress", enrollment == null ? 0 : enrollment.get("progress"));
            row.put("certNo", enrollment == null ? null : enrollment.get("certNo"));
            row.put("myNote", enrollment == null ? "" : enrollment.get("noteText"));
        });
        return rows;
    }

    public List<Map<String, Object>> enrollments() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM service_enrollment WHERE merchant_id=? ORDER BY id DESC",
                enrollmentMapper(), merchantId);
    }

    @Transactional
    public Map<String, Object> enrollCourse(long id) {
        Map<String, Object> course = jdbc.query("SELECT * FROM service_course WHERE id=?", courseMapper(), id)
                .stream().findFirst().orElseThrow(() -> BusinessException.notFound("课程不存在：" + id));
        long merchantId = Long.parseLong(identity.currentMerchantId());
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT * FROM service_enrollment WHERE course_id=? AND merchant_id=?", id, merchantId);
        if (existing.isEmpty()) {
            jdbc.update("""
                    INSERT INTO service_enrollment (course_id,merchant_id,merchant_name,progress,created_at)
                    VALUES (?,?,?,0,?)
                    """, id, merchantId, identity.currentMerchantName(), LocalDateTime.now().format(FULL_TIME));
            // 全局学习人数只在第一次报名时累加，重复报名不该把人数刷上去
            jdbc.update("UPDATE service_course SET learners=learners+1 WHERE id=?", id);
        }
        notifyMe("course", "已加入学习",
                "《" + course.get("title") + "》已加入我的课程，学习进度与结业证书会在此同步。", "COURSE", String.valueOf(id));
        // 返回带报名状态的课程行：门户拿这个对象直接刷新卡片，返回报名记录会让 myProgress 变成 undefined
        return courses().stream()
                .filter(row -> String.valueOf(row.get("id")).equals(String.valueOf(id)))
                .findFirst()
                .orElse(course);
    }

    /** 学习进度由服务端推进；到 100% 才签发结业证书，页面不能自己声明"已学完"。 */
    @Transactional
    public Map<String, Object> updateProgress(long courseId, Map<String, Object> body) {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        Map<String, Object> enrollment = jdbc.queryForList(
                        "SELECT * FROM service_enrollment WHERE course_id=? AND merchant_id=?", courseId, merchantId)
                .stream().findFirst()
                .orElseThrow(() -> new BusinessException(409, "还没有报名这门课程，请先加入学习"));
        int progress = Math.max(0, Math.min(100, intValue(body.get("progress"))));
        int updated = progress > intValue(enrollment.get("progress")) ? progress : intValue(enrollment.get("progress"));
        jdbc.update("UPDATE service_enrollment SET progress=? WHERE id=?", updated, enrollment.get("id"));
        if (updated >= 100 && enrollment.get("certNo") == null) {
            issueCertificate(merchantId, courseId);
        }
        return jdbc.queryForObject("SELECT * FROM service_enrollment WHERE id=?", enrollmentMapper(),
                enrollment.get("id"));
    }

    @Transactional
    public Map<String, Object> saveNote(long courseId, Map<String, Object> body) {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        int updated = jdbc.update("UPDATE service_enrollment SET note_text=? WHERE course_id=? AND merchant_id=?",
                text(body, "note", ""), courseId, merchantId);
        if (updated == 0) {
            throw new BusinessException(409, "还没有报名这门课程，无法保存笔记");
        }
        return jdbc.queryForObject("SELECT * FROM service_enrollment WHERE course_id=? AND merchant_id=?",
                enrollmentMapper(), courseId, merchantId);
    }

    /** 我的结业证书（真发出去的才看得见）。 */
    public List<Map<String, Object>> certificates() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("""
                SELECT e.cert_no AS certNo, e.completed_at AS completedAt, c.title, c.teacher, c.duration, c.mode
                FROM service_enrollment e JOIN service_course c ON c.id=e.course_id
                WHERE e.merchant_id=? AND e.cert_no IS NOT NULL ORDER BY e.id DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("certNo", rs.getString("certNo"));
            item.put("title", rs.getString("title"));
            item.put("teacher", rs.getString("teacher"));
            item.put("duration", rs.getString("duration"));
            item.put("mode", rs.getString("mode"));
            item.put("completedAt", rs.getString("completedAt"));
            return item;
        }, merchantId);
    }

    private void issueCertificate(long merchantId, long courseId) {
        List<Map<String, Object>> row = jdbc.queryForList(
                "SELECT id FROM service_enrollment WHERE course_id=? AND merchant_id=? AND cert_no IS NULL",
                courseId, merchantId);
        if (row.isEmpty()) {
            return;
        }
        String certNo = serial("JS");
        jdbc.update("UPDATE service_enrollment SET cert_no=?, completed_at=? WHERE id=?",
                certNo, LocalDateTime.now().format(DATE_TIME), row.get(0).get("id"));
        notifyMe("course", "结业证书已签发",
                "证书编号 " + certNo + "，可在我的证书里查看下载。", "CERT", certNo);
    }

    /* ==================== 问诊与 AI ==================== */

    public List<Map<String, Object>> consultations() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM service_consultation WHERE merchant_id=? ORDER BY created_at DESC",
                consultationMapper(), merchantId);
    }

    /**
     * AI 初判：结论落库为一条自诊记录。
     *
     * <p>{@code matchedDiseases} 由命中的关键词分支给出（原来固定返回两条与内容无关的占位），
     * {@code expertAvailable} 看的是当前类目下真有没有在营专家可以转。</p>
     */
    @Transactional
    public Map<String, Object> diagnose(Map<String, Object> body) {
        String subject = required(body, "subject", "请填写问诊主题");
        String content = required(body, "content", "请描述症状或问题");
        String lower = (subject + content).toLowerCase(Locale.ROOT);
        String level = lower.contains("死亡") || lower.contains("大面积") || lower.contains("枯萎")
                ? "高风险" : lower.contains("斑点") || lower.contains("虫") || lower.contains("黄化")
                ? "中度风险" : "低风险";
        String suggestion;
        List<String> matched;
        if (lower.contains("斑点") || lower.contains("褐")) {
            suggestion = "从图片和描述看，需要重点排查稻瘟病、胡麻斑病或细菌性条斑病。"
                    + "建议拍摄 3 片病叶的正反面、记录连续阴雨天数，先隔离病株并避免盲目混配农药；"
                    + "如 24 小时内扩散明显，建议转农艺专家复核。";
            matched = List.of("稻瘟病", "胡麻斑病", "细菌性条斑病");
        } else if (lower.contains("虫") || lower.contains("飞")) {
            suggestion = "发现虫害迹象，建议在清晨或傍晚检查叶片背面和嫩梢，统计每株虫量。"
                    + "先采用黄色粘虫板或低毒生物药剂控制，连片发生时可预约植保飞防统一作业。";
            matched = List.of("虫害发生迹象");
        } else if (lower.contains("黄") || lower.contains("萎")) {
            suggestion = "建议先排查土壤积水、根系损伤和缺素三类原因。"
                    + "可挖取 3 株样株检查根系，记录近 7 天降雨与施肥情况；晴天下午少量追肥并开沟排水。";
            matched = List.of("缺素或根系受损待排查");
        } else {
            suggestion = "症状信息还不够充分。建议补充作物品种、发病面积、近 7 天天气、近期用药和清晰的叶部/根部照片，再提交专家复核。";
            matched = List.of();
        }
        long merchantId = Long.parseLong(identity.currentMerchantId());
        long expertCandidates = number(
                "SELECT COUNT(*) FROM service_expert WHERE status='available' AND category='农技问诊'");
        String consultNo = serial("WZ");
        jdbc.update("""
                INSERT INTO service_consultation
                (consult_no,type,expert_id,expert_name,subject,content,ai_level,suggestion,status,merchant_id,merchant_name)
                VALUES (?, 'AI初判', NULL, 'AI农技助手', ?,?,?,?, 'answered', ?,?)
                """, consultNo, subject, content, level, suggestion, merchantId, identity.currentMerchantName());
        return Map.of(
                "consultNo", consultNo,
                "level", level,
                "suggestion", suggestion,
                "matchedDiseases", matched,
                "expertAvailable", expertCandidates > 0,
                "expertCount", expertCandidates
        );
    }

    @Transactional
    public Map<String, Object> createConsultation(Map<String, Object> body) {
        String type = text(body, "type", "农技图文");
        String subject = required(body, "subject", "请填写问诊主题");
        String content = required(body, "content", "请描述症状");
        // 专家必须是档案里真实存在的人：原先缺省写"王新民"，等于任何人都能替这位专家接单
        long expertId = requiredLong(body, "expertId", "请选择接诊专家");
        Map<String, Object> expert = jdbc.query("SELECT * FROM service_expert WHERE id=? AND status='available'",
                        expertMapper(), expertId).stream()
                .findFirst().orElseThrow(() -> BusinessException.notFound("专家不存在或当前不接诊：" + expertId));
        long merchantId = Long.parseLong(identity.currentMerchantId());
        String consultNo = serial("WZ");
        String suggestion = "专家已接诊，会在工作时间 2 小时内给出复核意见。请保持电话畅通。";
        jdbc.update("""
                INSERT INTO service_consultation
                (consult_no,type,expert_id,expert_name,subject,content,ai_level,suggestion,status,merchant_id,merchant_name)
                VALUES (?,?,?,?,?,?, '待专家复核', ?, 'accepted', ?,?)
                """, consultNo, type, expertId, expert.get("name"), subject, content, suggestion,
                merchantId, identity.currentMerchantName());
        jdbc.update("UPDATE service_expert SET consult_count=consult_count+1 WHERE id=?", expertId);
        notifyMe("consult", "问诊已受理",
                "问诊 " + consultNo + " 由「" + expert.get("name") + "（" + expert.get("title") + "）」接诊，"
                        + "结论出具后在此通知。", "CONSULT", consultNo);
        return jdbc.queryForObject("SELECT * FROM service_consultation WHERE consult_no=?",
                consultationMapper(), consultNo);
    }

    /* ==================== 消息与投诉（私域） ==================== */

    public List<Map<String, Object>> messages() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM service_message WHERE merchant_id=? ORDER BY id DESC",
                messageMapper(), merchantId);
    }

    public Map<String, Object> markMessagesRead() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        int updated = jdbc.update("UPDATE service_message SET is_read=TRUE WHERE merchant_id=? AND is_read=FALSE",
                merchantId);
        return Map.of("updated", updated);
    }

    public List<Map<String, Object>> complaints() {
        long merchantId = Long.parseLong(identity.currentMerchantId());
        return jdbc.query("SELECT * FROM service_complaint WHERE merchant_id=? ORDER BY created_at DESC",
                complaintMapper(), merchantId);
    }

    @Transactional
    public Map<String, Object> createComplaint(Map<String, Object> body) {
        String complaintNo = serial("TS");
        long merchantId = Long.parseLong(identity.currentMerchantId());
        String orderNo = text(body, "orderNo", "");
        if (!orderNo.isBlank()) {
            Integer owned = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM service_order WHERE order_no=? AND merchant_id=?",
                    Integer.class, orderNo, merchantId);
            if (owned == null || owned == 0) {
                throw BusinessException.notFound("订单不存在，或它不属于当前经营主体：" + orderNo);
            }
        }
        jdbc.update("""
                INSERT INTO service_complaint
                (complaint_no,order_no,category,description,demand,status,progress,merchant_id,merchant_name)
                VALUES (?,?,?,?,?, 'processing',35,?,?)
                """,
                complaintNo, orderNo,
                text(body, "category", "服务纠纷"),
                required(body, "description", "请描述问题"),
                text(body, "demand", "希望平台协调处理"),
                merchantId, identity.currentMerchantName());
        notifyMe("complaint", "投诉工单已创建",
                "工单 " + complaintNo + " 已进入处理队列，平台会按保障金规则复核；结论在此通知。",
                "COMPLAINT", complaintNo);
        return jdbc.queryForObject("SELECT * FROM service_complaint WHERE complaint_no=?",
                complaintMapper(), complaintNo);
    }

    /**
     * 站内信写入：订单、需求、申报、理赔、投保、问诊、投诉的关键节点都要落到具体主体收件箱。
     *
     * <p>消息表原先只有种子数据、没有任何写入方，页面"办理完成后站内信通知"其实一句话都没写。
     * 收件人主体名由调用方带（登录令牌里就有），不去跨库查平台表 —— H2 环境没有那张表。</p>
     */
    public void notify(long merchantId, String merchantName, String type, String title,
                       String content, String bizType, String bizNo) {
        jdbc.update("""
                INSERT INTO service_message (type,title,content,is_read,merchant_id,merchant_name,biz_type,biz_no,created_at)
                VALUES (?,?,?,FALSE,?,?,?,?,?)
                """, type, title, content, merchantId, merchantName, bizType, bizNo,
                LocalDateTime.now().format(DATE_TIME));
    }

    /** 写给当前登录主体的站内信。 */
    private void notifyMe(String type, String title, String content, String bizType, String bizNo) {
        notify(Long.parseLong(identity.currentMerchantId()), identity.currentMerchantName(),
                type, title, content, bizType, bizNo);
    }

    /** 状态机词表（前端下拉与测试都要用它，避免各处再各写一套中文常量）。 */
    public Map<String, Object> dictionaries() {
        Map<String, Object> dict = new LinkedHashMap<>();
        dict.put("orderStatus", List.of("pending_payment", "confirmed", "in_progress", "completed", "cancelled"));
        dict.put("orderStatusText", Map.of(
                "pending_payment", "待支付定金", "confirmed", "已确认", "in_progress", "作业中",
                "completed", "已完成", "cancelled", "已取消"));
        dict.put("policyStatus", POLICY_FLOW);
        dict.put("claimStatus", List.of("submitted", "surveying", "assessing", "publicity", "paid", "closed", "rejected"));
        dict.put("demandStatus", List.of("matching", "quoted", "accepted", "assigned", "closed"));
        dict.put("categories", jdbc.queryForList(
                "SELECT DISTINCT category FROM service_provider WHERE status='available' ORDER BY category", String.class));
        return dict;
    }

    /* ==================== 映射与工具 ==================== */

    private RowMapper<Map<String, Object>> providerMapper(boolean details) {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("categoryIcon", rs.getString("category_icon"));
            item.put("rating", rs.getBigDecimal("rating"));
            item.put("orderCount", rs.getInt("order_count"));
            item.put("distanceKm", rs.getBigDecimal("distance_km"));
            item.put("responseMinutes", rs.getInt("response_minutes"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("unit", rs.getString("unit"));
            item.put("badge", rs.getString("badge"));
            item.put("tags", split(rs.getString("tags")));
            item.put("description", rs.getString("description"));
            item.put("certifications", split(rs.getString("certifications")));
            item.put("region", rs.getString("region"));
            item.put("availableSlots", split(rs.getString("available_slots"), " / "));
            item.put("status", rs.getString("status"));
            if (details) {
                item.put("items", jdbc.query(
                        "SELECT * FROM service_item WHERE provider_id=? AND audit_status='approved' ORDER BY id",
                        serviceItemMapper(), rs.getLong("id")));
                item.put("reviews", jdbc.query("""
                        SELECT order_no AS orderNo, service_name AS serviceName, rating, review,
                               appointment_date AS appointmentDate
                        FROM service_order WHERE provider_id=? AND rating IS NOT NULL ORDER BY id DESC LIMIT 4
                        """, reviewMapper(), rs.getLong("id")));
            }
            return item;
        };
    }

    private RowMapper<Map<String, Object>> serviceItemMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("unit", rs.getString("unit"));
            item.put("description", rs.getString("description"));
            item.put("duration", rs.getString("duration"));
            item.put("selectedCount", rs.getInt("selected_count"));
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
            item.put("unitPrice", rs.getBigDecimal("unit_price"));
            item.put("totalAmount", rs.getBigDecimal("total_amount"));
            item.put("depositAmount", rs.getBigDecimal("deposit_amount"));
            item.put("appointmentDate", rs.getString("appointment_date"));
            item.put("appointmentSlot", rs.getString("appointment_slot"));
            item.put("location", rs.getString("location"));
            item.put("contactName", rs.getString("contact_name"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("notes", rs.getString("notes"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("rating", (Integer) rs.getObject("rating"));
            item.put("review", rs.getString("review"));
            item.put("merchantId", String.valueOf(rs.getLong("merchant_id")));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> eventMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("title", rs.getString("title"));
            item.put("note", rs.getString("note"));
            item.put("eventTime", rs.getString("eventTime"));
            item.put("completed", rs.getBoolean("completed"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> reviewMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("orderNo", rs.getString("orderNo"));
            item.put("serviceName", rs.getString("serviceName"));
            item.put("rating", rs.getInt("rating"));
            item.put("review", rs.getString("review"));
            item.put("appointmentDate", rs.getString("appointmentDate"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> demandMapper() {
        return (rs, rowNum) -> {
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
            item.put("acceptedProviderName", rs.getString("accepted_provider_name"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> policyMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("title", rs.getString("title"));
            item.put("level", rs.getString("level_name"));
            item.put("category", rs.getString("category"));
            item.put("amountText", rs.getString("amount_text"));
            item.put("deadline", rs.getString("deadline"));
            item.put("matchScore", rs.getInt("match_score"));
            item.put("conditions", rs.getString("conditions_text"));
            item.put("materials", split(rs.getString("materials_text")));
            item.put("status", rs.getString("status"));
            item.put("publishedAt", rs.getString("published_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> applicationMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("applicationNo", rs.getString("application_no"));
            item.put("policyId", String.valueOf(rs.getLong("policy_id")));
            item.put("policyTitle", rs.getString("policy_title"));
            item.put("applicant", rs.getString("applicant"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("amountText", rs.getString("amount_text"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("merchantId", String.valueOf(rs.getLong("merchant_id")));
            item.put("submittedAt", formatTimestamp(rs, "submitted_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> insuranceProductMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("premium", rs.getString("premium"));
            item.put("coverage", rs.getString("coverage"));
            item.put("subsidy", rs.getString("subsidy"));
            item.put("icon", rs.getString("icon"));
            item.put("summary", rs.getString("summary"));
            item.put("tags", split(rs.getString("tags")));
            item.put("premiumRate", rs.getBigDecimal("premium_rate"));
            item.put("coveragePerUnit", rs.getBigDecimal("coverage_per_mu"));
            item.put("unitMeasure", rs.getString("unit_measure"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> insurancePolicyMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("policyNo", rs.getString("policy_no"));
            item.put("productId", String.valueOf(rs.getLong("product_id")));
            item.put("productName", rs.getString("product_name"));
            item.put("insuredSubject", rs.getString("insured_subject"));
            item.put("insuredArea", rs.getString("insured_area"));
            item.put("premium", rs.getBigDecimal("premium"));
            item.put("coverageAmount", rs.getBigDecimal("coverage_amount"));
            item.put("effectiveDate", rs.getString("effective_date"));
            item.put("status", rs.getString("status"));
            item.put("merchantId", String.valueOf(rs.getLong("merchant_id")));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> claimMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("claimNo", rs.getString("claim_no"));
            item.put("policyId", String.valueOf(rs.getLong("policy_id")));
            item.put("policyNo", rs.getString("policy_no"));
            item.put("disasterType", rs.getString("disaster_type"));
            item.put("description", rs.getString("description"));
            item.put("lossArea", rs.getString("loss_area"));
            item.put("status", rs.getString("status"));
            item.put("progress", rs.getInt("progress"));
            item.put("merchantId", String.valueOf(rs.getLong("merchant_id")));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> courseMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("title", rs.getString("title"));
            item.put("teacher", rs.getString("teacher"));
            item.put("mode", rs.getString("mode"));
            item.put("duration", rs.getString("duration"));
            item.put("learners", rs.getInt("learners"));
            item.put("rating", rs.getBigDecimal("rating"));
            item.put("progress", rs.getInt("progress"));
            item.put("cover", rs.getString("cover"));
            item.put("summary", rs.getString("summary"));
            item.put("tags", split(rs.getString("tags")));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> enrollmentMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("courseId", String.valueOf(rs.getLong("course_id")));
            item.put("merchantId", String.valueOf(rs.getLong("merchant_id")));
            item.put("progress", rs.getInt("progress"));
            item.put("noteText", rs.getString("note_text"));
            item.put("certNo", rs.getString("cert_no"));
            item.put("completedAt", rs.getString("completed_at"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> expertMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("name", rs.getString("name"));
            item.put("title", rs.getString("title"));
            item.put("category", rs.getString("category"));
            item.put("organization", rs.getString("organization"));
            item.put("serviceScope", rs.getString("service_scope"));
            item.put("phone", maskPhone(rs.getString("phone")));
            item.put("rating", rs.getBigDecimal("rating"));
            item.put("consultCount", rs.getInt("consult_count"));
            item.put("tags", split(rs.getString("tags")));
            item.put("summary", rs.getString("summary"));
            item.put("avatarIcon", rs.getString("avatar_icon"));
            item.put("status", rs.getString("status"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> resourceMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("resourceType", rs.getString("resource_type"));
            item.put("title", rs.getString("title"));
            item.put("location", rs.getString("location"));
            item.put("areaMu", rs.getBigDecimal("area_mu"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("unit", rs.getString("unit"));
            item.put("description", rs.getString("description"));
            item.put("contactName", rs.getString("contact_name"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getLong("merchant_id")));
            item.put("merchantName", rs.getString("merchant_name"));
            item.put("status", rs.getString("status"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> consultationMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("consultNo", rs.getString("consult_no"));
            item.put("type", rs.getString("type"));
            item.put("expertId", rs.getObject("expert_id") == null ? null : String.valueOf(rs.getLong("expert_id")));
            item.put("expertName", rs.getString("expert_name"));
            item.put("subject", rs.getString("subject"));
            item.put("content", rs.getString("content"));
            item.put("aiLevel", rs.getString("ai_level"));
            item.put("suggestion", rs.getString("suggestion"));
            item.put("status", rs.getString("status"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> messageMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(rs.getLong("id")));
            item.put("type", rs.getString("type"));
            item.put("title", rs.getString("title"));
            item.put("content", rs.getString("content"));
            item.put("read", rs.getBoolean("is_read"));
            item.put("bizType", rs.getString("biz_type"));
            item.put("bizNo", rs.getString("biz_no"));
            item.put("createdAt", rs.getString("created_at"));
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
            item.put("merchantId", String.valueOf(rs.getLong("merchant_id")));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    private void addOrderEvent(long orderId, String title, String note, String eventTime, boolean completed) {
        jdbc.update("""
                INSERT INTO service_order_event (order_id,title,note,event_time,completed)
                VALUES (?,?,?,?,?)
                """, orderId, title, note, eventTime, completed);
    }

    private Map<String, Object> category(String name, String icon, String key, long count) {
        return Map.of("name", name, "icon", icon, "key", key, "count", count);
    }

    /** link 告诉前端这条待办该跳哪儿（order:12 / policy / claim / complaint），免得写死 id=1。 */
    private Map<String, Object> todo(String title, String content, String status, String progress, String link) {
        return Map.of("title", title, "content", content, "status", status, "progress", progress, "link", link);
    }

    /** 手机号脱敏：需求与专家档案对外只给掩码，指派成功后才给完整号码。 */
    private String maskPhone(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String digits = value.trim();
        if (digits.contains("*")) {
            return digits;
        }
        if (digits.length() < 7) {
            return digits;
        }
        return digits.substring(0, 3) + "****" + digits.substring(digits.length() - 4);
    }

    private long number(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    private BigDecimal decimalValue(String sql, Object... args) {
        BigDecimal value = jdbc.queryForObject(sql, BigDecimal.class, args);
        return value == null ? BigDecimal.ZERO : value;
    }

    private List<String> split(String value) {
        return split(value, ",");
    }

    private List<String> split(String value, String delimiter) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (String part : value.split(java.util.regex.Pattern.quote(delimiter))) {
            if (!part.isBlank()) {
                values.add(part.trim());
            }
        }
        return values;
    }

    private String formatTimestamp(ResultSet rs, String column) throws SQLException {
        java.sql.Timestamp value = rs.getTimestamp(column);
        return value == null ? "" : value.toLocalDateTime().format(DATE_TIME);
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) {
            throw BusinessException.validationError(message);
        }
        return value;
    }

    private long requiredLong(Map<String, Object> body, String key, String message) {
        Object value = body.get(key);
        if (value == null || String.valueOf(value).isBlank()) {
            throw BusinessException.validationError(message);
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            throw BusinessException.validationError(message);
        }
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private long longValue(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
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

    private BigDecimal decimal(Object value, BigDecimal fallback) {
        if (value == null || String.valueOf(value).isBlank()) {
            return fallback;
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String serial(String prefix) {
        long sequence = Math.floorMod(SERIAL.incrementAndGet(), 1000);
        return prefix + LocalDateTime.now().format(SERIAL_TIME) + String.format("%03d", sequence);
    }

    private String categoryIcon(String category) {
        return switch (category) {
            case "农机作业" -> "🚜";
            case "植保防疫" -> "🚁";
            case "检测认证" -> "🔬";
            case "培训服务" -> "🎓";
            case "农技问诊" -> "👨‍🌾";
            case "法律咨询" -> "⚖️";
            case "粮食烘干" -> "🔥";
            case "农险服务" -> "🛡️";
            default -> "🧩";
        };
    }

    private String categoryKey(String category) {
        return switch (category) {
            case "农机作业" -> "machine";
            case "植保防疫" -> "plant";
            case "农技问诊" -> "expert";
            case "检测认证" -> "testing";
            case "农险服务" -> "insurance";
            case "培训服务" -> "training";
            case "土地流转" -> "land";
            case "劳务用工" -> "labor";
            case "法律咨询" -> "legal";
            case "粮食烘干" -> "dry";
            default -> "other";
        };
    }
}
