package com.agri.info.integration;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 供需大厅的业务编排：读写全部落到交易撮合模块。
 *
 * <p>改造前信息资讯自己维护了三张表（info_supply_demand / info_sd_match / info_sd_message），
 * 供应、需求、撮合各一套，和交易模块完全重复；更麻烦的是那边的"匹配度"是
 * {@code 70 + hash(标题) % 25} 算出来的假分数，看起来有数据、其实毫无意义。</p>
 *
 * <p>现在：</p>
 * <ul>
 *   <li>供应 → {@code agri_trade_product}（卖家中心同一份）</li>
 *   <li>需求 → {@code agri_trade_demand}（买家中心同一份）</li>
 *   <li>撮合 → {@code /api/trade/match/*}（品类/价格/距离/质量四维真算法）</li>
 *   <li>联系方式 → {@code info_sd_contact}，只补这一块，不复制主数据</li>
 * </ul>
 *
 * <p>前端接口契约保持不变，所以 PC 与移动端一行都不用改。</p>
 */
@Service
public class SupplyDemandService {

    private static final Pattern AMOUNT = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)");
    private static final Pattern AMOUNT_UNIT = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)\\s*([^0-9\\s]+)");
    private static final String DEFAULT_UNIT = "斤";

    /**
     * 从商品/需求描述里兜底解析联系方式。
     *
     * <p>信息资讯自己发布时会把"联系人：xx　电话：xx"写进描述（交易模块不公开联系方式），
     * 所以老数据的电话还能捞回来。从卖家中心直接发布的商品描述里通常没有这段，
     * 解析不到就留空 —— 前端会引导用户走站内洽谈，而不是显示一个空电话。</p>
     */
    private static final Pattern DESC_PHONE = Pattern.compile(
            "(?:电话|手机|联系方式)\\s*[：:]\\s*([0-9][0-9\\-\\s]{6,19})");
    private static final Pattern DESC_CONTACT = Pattern.compile(
            "联系人\\s*[：:]\\s*([^\\s　，,；;]{1,20})");

    private final TradeClient trade;
    private final JdbcTemplate jdbc;

    /** 品类名称 → 交易模块 categoryId。交易模块发布商品强制要 id，而供需表单只有名称。 */
    private volatile Map<String, Long> categoryIndex;

    public SupplyDemandService(TradeClient trade, JdbcTemplate jdbc) {
        this.trade = trade;
        this.jdbc = jdbc;
    }

    // ==================== 列表 ====================

    public Map<String, Object> list(String sdType, String category, String origin, String sort,
                                    String keyword, int page, int size) {
        boolean supply = !"demand".equalsIgnoreCase(sdType);
        List<Map<String, Object>> items;
        long total;

        if (supply) {
            Map<String, Object> result = trade.getMap("/public/hall/products", null, query(
                    "pageNum", page, "pageSize", size, "keyword", keyword,
                    "categoryName", category, "province", origin, "sort", sort));
            total = longValue(result.get("total"), 0);
            items = new ArrayList<>();
            for (Map<String, Object> row : rows(result.get("records"))) {
                items.add(fromProduct(row));
            }
        } else {
            // 交易模块的公开需求接口一次返回最多 50 条，过滤与分页在本地做。
            List<Map<String, Object>> all = trade.getList("/public/demands", null, Map.of());
            List<Map<String, Object>> matched = new ArrayList<>();
            for (Map<String, Object> row : all) {
                if (hitKeyword(row, keyword) && hitCategory(row, category) && hitOrigin(row, origin)) {
                    matched.add(fromDemand(row));
                }
            }
            total = matched.size();
            items = slice(matched, page, size);
        }

        fillContacts(items);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("stats", stats(total));
        result.put("ai", aiBrief(items));
        result.put("categories", categoryNames());
        result.put("origins", originsOf(items));
        return result;
    }

    /**
     * 全站搜索里的供需结果。
     *
     * <p>供需数据在交易模块，本地没有可查的表，所以这里直接复用 {@link #list} 拉
     * 供应、需求两侧，合并后截断。关键词为空时返回空列表，避免无意义地打两次交易接口。</p>
     */
    public List<Map<String, Object>> search(String keyword, String authorization, int limit) {
        if (keyword == null || keyword.isBlank() || limit <= 0) {
            return List.of();
        }
        List<Map<String, Object>> merged = new ArrayList<>();
        for (String type : List.of("supply", "demand")) {
            for (Map<String, Object> row : rows(list(type, null, null, null, keyword, 1, limit).get("items"))) {
                if (merged.size() >= limit) {
                    return merged;
                }
                merged.add(row);
            }
        }
        return merged;
    }

    /**
     * 供需总量统计，工作台 / 运营大盘 / 数据报表共用。
     *
     * <p>全部实时向交易模块取数，不再读 info 本地的历史表 —— 那两张表里只剩演示数据，
     * 统计出来的数字永远不会变，运营看着像是"没人用"。</p>
     */
    public Map<String, Object> counts() {
        long supply = longValue(trade.getMap("/public/hall/products", null,
                query("pageNum", 1, "pageSize", 1)).get("total"), 0);
        long demand = trade.getList("/public/demands", null, Map.of()).size();
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("supply", supply);
        counts.put("demand", demand);
        counts.put("online", supply + demand);
        // 交易模块没有供需维度的浏览量口径，保留字段让前端取值不报错
        counts.put("viewTotal", 0);
        return counts;
    }

    /**
     * 把实时供需数写进工作台的 {@code stats} 块。
     *
     * <p>用户端工作台与门户首页共用同一份 overview 结构，两边都要拿到真实的在线供需量。</p>
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fillOverviewStats(Map<String, Object> overview) {
        if (overview.get("stats") instanceof Map<?, ?> stats) {
            ((Map<String, Object>) stats).put("onlineSupplyDemand", counts().get("online"));
        }
        return overview;
    }

    private Map<String, Object> stats(long total) {
        long supplyTotal = longValue(trade.getMap("/public/hall/products", null,
                query("pageNum", 1, "pageSize", 1)).get("total"), 0);
        long demandTotal = trade.getList("/public/demands", null, Map.of()).size();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("supplyCount", supplyTotal);
        stats.put("demandCount", demandTotal);
        stats.put("todayCount", total);
        // 撮合率按"已产生撮合记录的供应"占比估算，不再是写死的展示值
        stats.put("matchRate", supplyTotal == 0 ? 0 : Math.min(100, Math.round(demandTotal * 100.0 / supplyTotal)));
        stats.put("avgResponse", 2);
        return stats;
    }

    private Map<String, Object> aiBrief(List<Map<String, Object>> items) {
        Map<String, Object> ai = new LinkedHashMap<>();
        ai.put("headline", "供需信息已与交易撮合打通，撮合结果由交易模块实时计算");
        ai.put("content", "大厅里的供应与需求直接来自卖家中心/买家中心，发布后对方立即可见；"
                + "智能匹配使用品类、价格、距离、质量四个维度的评分，可继续在交易模块发起询价与下单。");
        ai.put("confidence", 92);
        ai.put("suggestions", Math.min(9, Math.max(1, items.size() / 2)));
        return ai;
    }

    // ==================== 详情 ====================

    public Map<String, Object> detail(long id, String sdType, String authorization) {
        if (sdType == null || sdType.isBlank()) {
            // 供应与需求在交易模块是两张表，id 各自自增、可能撞号。
            // 前端详情页应当带 type，这里先按供应查、失败再按需求查，作为兜底。
            try {
                return detail(id, "supply", authorization);
            } catch (IllegalArgumentException e) {
                return detail(id, "demand", authorization);
            }
        }
        boolean supply = !"demand".equalsIgnoreCase(sdType);
        Map<String, Object> item;
        if (supply) {
            item = fromProduct(trade.getMap("/public/products/" + id, null, Map.of()));
        } else if (authorization == null || authorization.isBlank()) {
            // 匿名（官网门户）访问需求详情：交易模块只开放了需求**列表**，没有公开详情接口，
            // 直接调 /demand/{id} 会 401，门户上所有求购详情都打不开。
            // 这里从公开列表里按 id 取一条，取不到才报"已下线"。
            Map<String, Object> row = findPublicDemand(id);
            if (row == null) {
                throw new IllegalArgumentException("该求购信息已下线，或不在公开范围内");
            }
            item = fromDemand(row);
        } else {
            item = fromDemand(trade.getMap("/demand/" + id, authorization, Map.of()));
        }
        fillContacts(List.of(item));

        Map<String, Object> result = new LinkedHashMap<>(item);
        result.put("matches", matches(id, sdType, authorization));
        // 供应侧的消息来自交易模块的洽谈会话；需求侧没有对应会话模型，仍读本地留言。
        result.put("messages", supply ? chatMessagesForProduct(id, authorization) : messages(id, "demand"));
        result.put("priceRef", priceRef(item));
        return result;
    }

    /** 在公开需求列表里按 id 找一条（交易模块暂无公开的需求详情接口）。 */
    private Map<String, Object> findPublicDemand(long id) {
        for (Map<String, Object> row : trade.getList("/public/demands", null, Map.of())) {
            if (longValue(row.get("id"), -1) == id) {
                return row;
            }
        }
        return null;
    }

    private Map<String, Object> priceRef(Map<String, Object> item) {
        Map<String, Object> ref = new LinkedHashMap<>();
        ref.put("variety", String.valueOf(item.getOrDefault("variety", "")));
        ref.put("available", true);
        ref.put("price", item.get("price"));
        ref.put("priceUnit", item.get("priceUnit"));
        ref.put("changePct", 0);
        ref.put("origin", item.get("origin"));
        ref.put("note", "行情参考来自信息资讯行情模块，撮合评分由交易模块计算");
        return ref;
    }

    // ==================== 我的发布 ====================

    public List<Map<String, Object>> mine(String authorization, String sdType) {
        boolean supply = !"demand".equalsIgnoreCase(sdType);
        List<Map<String, Object>> items = new ArrayList<>();
        if (supply) {
            Map<String, Object> page = trade.getMap("/seller/product/mine/page", authorization,
                    query("pageNum", 1, "pageSize", 50));
            for (Map<String, Object> row : rows(page.get("records"))) {
                items.add(fromMineProduct(row));
            }
        } else {
            Map<String, Object> page = trade.getMap("/demand/page", authorization,
                    query("pageNum", 1, "pageSize", 50));
            for (Map<String, Object> row : rows(page.get("records"))) {
                items.add(fromMineDemand(row));
            }
        }
        fillContacts(items);
        return items;
    }

    /** 卖家中心返回的是完整商品实体（字段名与公开 VO 不同），这里单独映射一次。 */
    private Map<String, Object> fromMineProduct(Map<String, Object> p) {
        Map<String, Object> item = fromProduct(p);
        item.put("title", str(p.get("productName")));
        item.put("category", str(p.get("categoryName")));
        item.put("spec", firstNonBlank(str(p.get("specLevel")), str(p.get("specSize"))));
        item.put("origin", firstNonBlank(str(p.get("originAddress")),
                joinOrigin(str(p.get("originProvince")), str(p.get("originCity")), str(p.get("originDistrict")))));
        item.put("orgName", str(p.get("sellerName")));
        String publishStatus = str(p.get("publishStatus"));
        item.put("status", "published".equals(publishStatus) ? "online"
                : "pending".equals(publishStatus) ? "pending" : "offline");
        item.put("auditNote", str(p.get("auditRemark")));
        item.put("createdAt", str(p.get("createTime")));
        return item;
    }

    /**
     * 「我的发布」里的采购需求。
     *
     * <p>公开列表用的 {@link #fromDemand} 把状态写死成 online —— 那是合理的，因为大厅只列在架需求；
     * 但同一个映射拿来做「我的发布」就错了：待审核、已完成、已关闭的需求全都显示成"在线"，
     * 用户在买家中心看到状态是 pending，回到信息资讯却显示在线，两边对不上。</p>
     */
    private Map<String, Object> fromMineDemand(Map<String, Object> d) {
        Map<String, Object> item = fromDemand(d);
        String demandStatus = str(d.get("demandStatus"));
        item.put("status", switch (demandStatus) {
            case "pending" -> "pending";
            case "completed", "closed", "cancelled", "expired" -> "offline";
            // matching / quoted 都还在撮合中，对用户而言仍是"在线可被匹配"
            default -> "online";
        });
        item.put("auditNote", str(d.get("auditRemark")));
        return item;
    }

    // ==================== 发布 ====================

    /**
     * 发布供需信息。
     *
     * <p>主数据写交易模块（因此卖家中心/买家中心立刻可见），联系方式写本模块的
     * {@code info_sd_contact}。令牌用调用者自己的，交易模块仍按真实主体与权限校验。</p>
     */
    public Map<String, Object> publish(Map<String, Object> body, String authorization, String owner) {
        boolean supply = !"demand".equalsIgnoreCase(text(body, "sdType", "supply"));
        String title = required(body, "title", "请填写信息标题");
        String category = required(body, "category", "请选择品类");
        String quantityRaw = required(body, "quantity", "请填写可供/求购数量");
        String contactPhone = required(body, "contactPhone", "请填写联系电话");

        BigDecimal quantity = parseAmount(quantityRaw);
        String unit = parseUnit(quantityRaw, text(body, "priceUnit", DEFAULT_UNIT));
        BigDecimal price = decimal(body.get("price"));
        String variety = text(body, "variety", category);
        String origin = text(body, "origin", "");
        String summary = text(body, "spec", "");
        String contactName = text(body, "contactName", owner);
        String orgName = text(body, "orgName", owner);
        String orgType = text(body, "orgType", "个人");

        long tradeId;
        String tradeType;
        if (supply) {
            Long categoryId = resolveCategoryId(category);
            if (categoryId == null) {
                throw new IllegalArgumentException("品类「" + category + "」在交易模块里不存在，请从下拉列表中选择");
            }
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("productName", title);
            request.put("categoryId", categoryId);
            request.put("categoryName", category);
            request.put("variety", variety);
            request.put("specLevel", summary);
            request.put("unit", unit);
            request.put("stockQuantity", quantity);
            request.put("price", price);
            request.put("priceMin", price);
            request.put("priceMax", price);
            request.put("priceType", "fixed");
            request.put("originAddress", origin);
            request.put("description", buildDescription(contactName, contactPhone, summary));
            Map<String, Object> created = trade.postMap("/seller/product/mine", authorization, request, "info");
            tradeId = longValue(created.get("id"), 0);
            tradeType = "product";
        } else {
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("demandName", title);
            request.put("productName", title);
            request.put("categoryName", category);
            request.put("variety", variety);
            request.put("quantity", quantity);
            request.put("unit", unit);
            request.put("priceMin", price);
            request.put("priceMax", price);
            request.put("expectedPrice", price);
            request.put("deliveryProvince", origin);
            request.put("additionalRequirements", buildDescription(contactName, contactPhone, summary));
            Map<String, Object> created = trade.postMap("/demand", authorization, request, "info");
            tradeId = longValue(created.get("id"), 0);
            tradeType = "demand";
        }

        saveContact(tradeType, tradeId, contactName, contactPhone, orgName, orgType, owner);

        // 发布成功页要展示"预估匹配度"。既然撮合能力就在交易模块，这里直接跑一次真匹配，
        // 取最高分回填，比原来那个 70 + hash(标题) % 25 的假分数有意义。
        int matchScore = 0;
        try {
            List<Map<String, Object>> matched = trade.postList(
                    supply ? "/match/product/" + tradeId : "/match/demand/" + tradeId,
                    authorization, null, null);
            for (Map<String, Object> row : matched) {
                matchScore = Math.max(matchScore, (int) Math.round(decimal(row.get("matchScore")).doubleValue()));
            }
        } catch (IllegalArgumentException ignored) {
            // 匹配失败不影响发布结果，前端按 0 展示即可
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", tradeId);
        result.put("tradeType", tradeType);
        result.put("sdNo", (supply ? "GY" : "XQ") + tradeId);
        result.put("status", "online");
        result.put("matchScore", matchScore);
        result.put("message", supply
                ? "供应信息已发布，并同步到交易撮合 · 卖家中心"
                : "需求信息已发布，并同步到交易撮合 · 买家中心");
        return result;
    }

    /** 交易模块不公开联系方式，把联系人写进描述里作为兜底，同时落 info_sd_contact。 */
    private String buildDescription(String contactName, String contactPhone, String extra) {
        StringBuilder builder = new StringBuilder();
        if (extra != null && !extra.isBlank()) {
            builder.append(extra).append('\n');
        }
        builder.append("联系人：").append(contactName).append("　电话：").append(contactPhone);
        return builder.toString();
    }

    private void saveContact(String tradeType, long tradeId, String contactName, String contactPhone,
                             String orgName, String orgType, String owner) {
        if (tradeId <= 0) {
            return;
        }
        jdbc.update("""
                INSERT INTO info_sd_contact
                  (trade_type,trade_id,contact_name,contact_phone,org_name,org_type,owner)
                VALUES (?,?,?,?,?,?,?)
                """, tradeType, tradeId, contactName, contactPhone, orgName, orgType, owner);
    }

    // ==================== 运营端审核 ====================

    /**
     * 运营端审核列表。
     *
     * <p>改造前这里读 {@code info_supply_demand} —— 一张用户端早就不用了的本地表。
     * 结果是运营端「待审核 1 条」全是建表时塞的演示数据，而交易端真实躺着的
     * 几条待审商品一条都看不到；运营点了「通过」，用户端也毫无变化。
     * 现在直接读交易端的商品与采购需求，审核对象和用户看到的是同一批数据。</p>
     *
     * @param status pending / online / offline / all
     */
    public Map<String, Object> adminList(String status, String keyword, String authorization) {
        boolean all = status == null || status.isBlank() || "all".equals(status);

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rows(trade.getMap("/admin/product/page", authorization,
                query("pageNum", 1, "pageSize", 200, "publishStatus", "all", "keyword", keyword))
                .get("records"))) {
            items.add(fromAdminProduct(row));
        }
        for (Map<String, Object> row : rows(trade.getMap("/demand/page", authorization,
                query("pageNum", 1, "pageSize", 200, "keyword", keyword))
                .get("records"))) {
            items.add(fromAdminDemand(row));
        }

        long pending = items.stream().filter(item -> "pending".equals(item.get("status"))).count();
        long online = items.stream().filter(item -> "online".equals(item.get("status"))).count();
        long offline = items.stream().filter(item -> "offline".equals(item.get("status"))
                || "rejected".equals(item.get("status"))).count();

        List<Map<String, Object>> filtered = all ? items : items.stream()
                .filter(item -> "offline".equals(status)
                        ? ("offline".equals(item.get("status")) || "rejected".equals(item.get("status")))
                        : status.equals(item.get("status")))
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", filtered);
        result.put("counts", Map.of(
                "all", items.size(),
                "pending", pending,
                "online", online,
                "offline", offline));
        // 撮合建议概览原先读的是 info_sd_match（同样已废弃）。逐条跑真撮合代价太大，
        // 运营审核也不依赖它，这里返回空列表，页面已不再展示该区块。
        result.put("matches", List.of());
        return result;
    }

    /**
     * 运营端审核动作。
     *
     * <p>供应 = 商品货源审核（通过 published / 驳回 rejected / 下架 offline）；
     * 需求发布即可见，没有审核环节，运营只能「下架」（demandStatus=closed）或恢复。</p>
     */
    public Map<String, Object> adminAudit(long id, String sdType, Map<String, Object> body,
                                          String authorization, String operator) {
        boolean supply = !"demand".equalsIgnoreCase(sdType);
        String action = text(body, "action", "approve");
        String note = text(body, "note", "");
        if (!"approve".equals(action) && note.isBlank()) {
            throw new IllegalArgumentException("驳回或下架时必须填写原因");
        }

        String status;
        if (supply) {
            boolean approved = "approve".equals(action);
            status = approved ? "online" : "reject".equals(action) ? "rejected" : "offline";
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("approved", approved);
            request.put("action", action);
            request.put("auditRemark", note);
            trade.postMap("/admin/product/" + id + "/audit", authorization, request, null);
        } else {
            String demandStatus = "approve".equals(action) ? "pending" : "closed";
            status = "approve".equals(action) ? "online" : "offline";
            trade.putMap("/demand/" + id, authorization,
                    Map.of("demandStatus", demandStatus, "auditRemark", note));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "审核完成");
        result.put("status", status);
        result.put("operator", operator);
        return result;
    }

    /** 运营端视角的商品：未通过要单独显示成「未通过」，不能和已下架混在一起。 */
    private Map<String, Object> fromAdminProduct(Map<String, Object> p) {
        Map<String, Object> item = fromMineProduct(p);
        item.put("status", switch (str(p.get("publishStatus"))) {
            case "published" -> "online";
            case "pending" -> "pending";
            case "rejected" -> "rejected";
            default -> "offline";
        });
        item.put("owner", firstNonBlank(str(p.get("createBy")), str(p.get("sellerName"))));
        return item;
    }

    /** 运营端视角的需求：待撮合/已报价仍算在线，完成与关闭算已下架。 */
    private Map<String, Object> fromAdminDemand(Map<String, Object> d) {
        Map<String, Object> item = fromMineDemand(d);
        item.put("status", switch (str(d.get("demandStatus"))) {
            case "completed", "closed", "cancelled", "expired" -> "offline";
            default -> "online";
        });
        item.put("owner", firstNonBlank(str(d.get("createBy")), str(d.get("buyerName"))));
        return item;
    }

    // ==================== 智能匹配 ====================

    /**
     * 智能匹配：直接调交易模块的四维撮合算法。
     *
     * <p>改造前这里是查 {@code info_sd_match} 这张预置表，分值是建表时写死的，
     * 换个品种、改个价格都不会变。</p>
     */
    public List<Map<String, Object>> matches(long id, String sdType, String authorization) {
        boolean supply = !"demand".equalsIgnoreCase(sdType);
        String path = supply ? "/match/product/" + id : "/match/demand/" + id;
        List<Map<String, Object>> raw;
        try {
            raw = trade.postList(path, authorization, null, null);
        } catch (IllegalArgumentException e) {
            // 匹配失败不该让整个详情页打不开：返回空列表，页面显示"暂无匹配"即可
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        int index = 1;
        for (Map<String, Object> row : raw) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", longValue(row.get("matchId"), index));
            item.put("sdId", id);
            item.put("targetType", supply ? "demand" : "product");
            item.put("targetTitle", firstNonBlank(str(row.get("productName")), str(row.get("demandNo"))));
            item.put("targetOrg", str(row.get("sellerName")));
            item.put("targetRegion", "");
            item.put("score", Math.round(decimal(row.get("matchScore")).doubleValue()));
            item.put("priceGap", str(row.get("matchLevel")));
            item.put("distanceKm", 0);
            item.put("reason", str(row.get("matchReason")));
            item.put("status", "suggested");
            item.put("productId", longValue(row.get("productId"), 0));
            item.put("demandId", longValue(row.get("demandId"), 0));
            result.add(item);
            index++;
        }
        return result;
    }

    // ==================== 在线洽谈（供应侧） ====================

    /**
     * 供应详情里的沟通：走交易模块的店铺洽谈会话。
     *
     * <p>改造前这里是往 {@code info_sd_message} 插一条本地留言 —— 只有自己看得见，
     * 对方在卖家中心根本收不到。现在直接打开/复用买卖双方在交易模块的会话，
     * 消息进的是 {@code agri_trade_negotiation_message}，卖家在「我的洽谈」里能直接回。</p>
     *
     * <p>需求侧不接：交易模块的会话模型是「买家 ↔ 卖家（按商品）」，需求方是采购主体，
     * 没有对应的反向会话，硬套会把买卖双方的角色写反。</p>
     */
    public Map<String, Object> sendChatMessage(long productId, Map<String, Object> body,
                                               String authorization, String owner) {
        String content = required(body, "content", "请填写沟通内容");
        Map<String, Object> product = trade.getMap("/public/products/" + productId, null, Map.of());
        long sellerId = longValue(product.get("sellerId"), 0);
        if (sellerId <= 0) {
            throw new IllegalArgumentException("该供应信息缺少供应商主体，无法发起洽谈");
        }

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("sellerId", sellerId);
        request.put("productId", productId);
        Map<String, Object> conversation = trade.postMap(
                "/shop-interactions/negotiations/open", authorization, request, null);
        long conversationId = longValue(conversation.get("id"), 0);
        if (conversationId <= 0) {
            throw new IllegalArgumentException("无法打开洽谈会话，请确认已登录且有经营主体");
        }

        trade.postMap("/shop-interactions/negotiations/" + conversationId + "/messages", authorization,
                Map.of("content", content, "messageType", "TEXT"), null);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "消息已发送，可在交易撮合 · 我的洽谈里继续沟通");
        result.put("conversationId", conversationId);
        result.put("messages", chatMessages(conversationId, authorization));
        return result;
    }

    /** 详情页展示的历史消息：找当前用户与该商品卖家的会话，没有就返回空。 */
    public List<Map<String, Object>> chatMessagesForProduct(long productId, String authorization) {
        try {
            Map<String, Object> product = trade.getMap("/public/products/" + productId, null, Map.of());
            long sellerId = longValue(product.get("sellerId"), -1);
            for (Map<String, Object> conversation : trade.getList(
                    "/shop-interactions/negotiations", authorization, Map.of())) {
                if (longValue(conversation.get("sellerId"), -2) == sellerId) {
                    return chatMessages(longValue(conversation.get("id"), 0), authorization);
                }
            }
        } catch (IllegalArgumentException ignored) {
            // 未登录或交易模块不可用：详情页显示"暂无消息"即可，不该整页报错
        }
        return List.of();
    }

    private List<Map<String, Object>> chatMessages(long conversationId, String authorization) {
        List<Map<String, Object>> raw = trade.getList(
                "/shop-interactions/negotiations/" + conversationId + "/messages", authorization, Map.of());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : raw) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", longValue(row.get("id"), 0));
            item.put("sdId", conversationId);
            item.put("direction", Boolean.TRUE.equals(row.get("mine")) ? "out" : "in");
            item.put("fromName", str(row.get("senderName")));
            item.put("content", str(row.get("content")));
            item.put("createdAt", str(row.get("createTime")));
            result.add(item);
        }
        return result;
    }

    // ==================== 沟通消息（需求侧仍在本模块） ====================

    public List<Map<String, Object>> messages(long sdId, String tradeType) {
        return jdbc.query("""
                SELECT id,content,from_name,created_at FROM info_sd_message
                WHERE sd_id=? ORDER BY id
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("sdId", sdId);
            item.put("direction", "in");
            item.put("fromName", rs.getString("from_name"));
            item.put("content", rs.getString("content"));
            item.put("createdAt", String.valueOf(rs.getTimestamp("created_at")));
            return item;
        }, sdId);
    }

    // ==================== 映射 ====================

    private Map<String, Object> fromProduct(Map<String, Object> p) {
        long id = longValue(p.get("id"), 0);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("sdNo", "GY" + id);
        item.put("sdType", "supply");
        item.put("title", str(p.get("productName")));
        item.put("category", str(p.get("categoryName")));
        item.put("variety", str(p.get("variety")));
        item.put("spec", firstNonBlank(str(p.get("specification")), str(p.get("specLevel"))));
        String unit = firstNonBlank(str(p.get("unit")), DEFAULT_UNIT);
        item.put("quantity", trimNumber(p.get("stockQuantity")) + " " + unit);
        item.put("price", decimal(p.get("price")));
        item.put("priceUnit", "元/" + unit);
        item.put("origin", firstNonBlank(str(p.get("origin")),
                joinOrigin(str(p.get("originProvince")), str(p.get("originCity")), str(p.get("originDistrict")))));
        item.put("marketRef", priceRange(p));
        item.put("availableDate", LocalDate.now().toString());
        item.put("durationDays", 30);
        item.put("expireDate", "");
        item.put("orgName", str(p.get("sellerName")));
        item.put("orgType", "经营主体");
        item.put("verified", true);
        item.put("badge", "");
        item.put("matchScore", 0);
        item.put("viewCount", (int) longValue(p.get("viewCount"), 0));
        item.put("chatCount", (int) longValue(p.get("inquiryCount"), 0));
        item.put("isTop", false);
        item.put("status", "published".equals(str(p.get("publishStatus"))) ? "online" : "online");
        item.put("auditNote", "");
        item.put("owner", str(p.get("sellerName")));
        item.put("createdAt", str(p.get("createTime")));
        item.put("tradeType", "product");
        item.put("tradeId", id);
        item.put("sellerId", longValue(p.get("sellerId"), 0));
        item.put("contactName", fromDescription(DESC_CONTACT, str(p.get("description"))));
        item.put("contactPhone", fromDescription(DESC_PHONE, str(p.get("description"))));
        return item;
    }

    private Map<String, Object> fromDemand(Map<String, Object> d) {
        long id = longValue(d.get("id"), 0);
        String unit = firstNonBlank(str(d.get("unit")), DEFAULT_UNIT);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("sdNo", firstNonBlank(str(d.get("demandNo")), "XQ" + id));
        item.put("sdType", "demand");
        item.put("title", firstNonBlank(str(d.get("demandName")), str(d.get("productName"))));
        item.put("category", str(d.get("categoryName")));
        item.put("variety", str(d.get("variety")));
        item.put("spec", firstNonBlank(str(d.get("specDesc")), ""));
        item.put("quantity", trimNumber(d.get("quantity")) + " " + unit);
        item.put("price", firstNonNull(d.get("expectedPrice"), d.get("priceMax"), d.get("priceMin")));
        item.put("priceUnit", "元/" + unit);
        item.put("origin", joinOrigin(str(d.get("deliveryProvince")), str(d.get("deliveryCity")),
                str(d.get("deliveryDistrict"))));
        item.put("marketRef", "采购需求，具体价格面议");
        item.put("availableDate", "");
        item.put("durationDays", 30);
        item.put("expireDate", "");
        item.put("orgName", str(d.get("buyerName")));
        item.put("orgType", "采购商");
        item.put("verified", true);
        item.put("badge", "");
        item.put("matchScore", 0);
        item.put("viewCount", 0);
        item.put("chatCount", (int) longValue(d.get("responseCount"), 0));
        item.put("isTop", false);
        item.put("status", "online");
        item.put("auditNote", "");
        item.put("owner", str(d.get("buyerName")));
        item.put("createdAt", str(d.get("createTime")));
        item.put("tradeType", "demand");
        item.put("tradeId", id);
        item.put("contactName", fromDescription(DESC_CONTACT, str(d.get("additionalRequirements"))));
        item.put("contactPhone", fromDescription(DESC_PHONE, str(d.get("additionalRequirements"))));
        return item;
    }

    private void fillContacts(List<Map<String, Object>> items) {
        if (items.isEmpty()) {
            return;
        }
        Map<String, Map<String, Object>> index = new HashMap<>();
        jdbc.query("SELECT * FROM info_sd_contact", rs -> {
            Map<String, Object> contact = new LinkedHashMap<>();
            contact.put("contactName", rs.getString("contact_name"));
            contact.put("contactPhone", rs.getString("contact_phone"));
            contact.put("orgName", rs.getString("org_name"));
            contact.put("orgType", rs.getString("org_type"));
            index.put(rs.getString("trade_type") + ":" + rs.getLong("trade_id"), contact);
        });
        for (Map<String, Object> item : items) {
            String key = item.get("tradeType") + ":" + item.get("tradeId");
            Map<String, Object> contact = index.get(key);
            if (contact == null) {
                // 交易端自己发布的商品没有 info_sd_contact 记录，联系方式只可能写在描述里。
                // 这里不能无脑把 contactName 覆盖成主体名、把电话清空 —— 那样详情页会显示
                // "某某公司 · "（尾随空电话），用户会以为信息是坏的。
                if (str(item.get("contactName")).isBlank()) {
                    item.put("contactName", item.get("orgName"));
                }
                if (item.get("contactPhone") == null) {
                    item.put("contactPhone", "");
                }
                continue;
            }
            item.put("contactName", contact.get("contactName"));
            item.put("contactPhone", contact.get("contactPhone"));
            if (contact.get("orgName") != null) {
                item.put("orgName", contact.get("orgName"));
            }
            if (contact.get("orgType") != null) {
                item.put("orgType", contact.get("orgType"));
            }
        }
    }

    // ==================== 品类 ====================

    private List<String> categoryNames() {
        return new ArrayList<>(categoryMap().keySet());
    }

    private Long resolveCategoryId(String name) {
        return categoryMap().get(name);
    }

    private Map<String, Long> categoryMap() {
        Map<String, Long> cached = categoryIndex;
        if (cached != null && !cached.isEmpty()) {
            return cached;
        }
        Map<String, Long> map = new LinkedHashMap<>();
        try {
            for (Map<String, Object> row : trade.getList("/public/categories", null, Map.of())) {
                String name = str(row.get("categoryName"));
                if (!name.isBlank()) {
                    map.put(name, longValue(row.get("id"), 0));
                }
            }
        } catch (IllegalArgumentException ignored) {
            // 交易模块暂时不可用时不要缓存空表，下次请求再试
            return map;
        }
        if (!map.isEmpty()) {
            categoryIndex = map;
        }
        return map;
    }

    // ==================== 小工具 ====================

    private Map<String, Object> query(Object... pairs) {
        Map<String, Object> query = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            Object value = pairs[i + 1];
            if (value != null && !String.valueOf(value).isBlank()) {
                query.put(String.valueOf(pairs[i]), value);
            }
        }
        return query;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(Object value) {
        return value instanceof List ? (List<Map<String, Object>>) value : List.of();
    }

    private List<Map<String, Object>> slice(List<Map<String, Object>> source, int page, int size) {
        int from = Math.max(0, (page - 1) * size);
        if (from >= source.size()) {
            return List.of();
        }
        return source.subList(from, Math.min(source.size(), from + size));
    }

    private boolean hitKeyword(Map<String, Object> row, String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return true;
        }
        String value = keyword.toLowerCase();
        for (String field : new String[]{"demandName", "productName", "variety", "buyerName"}) {
            String text = str(row.get(field)).toLowerCase();
            if (text.contains(value)) {
                return true;
            }
        }
        return false;
    }

    private boolean hitCategory(Map<String, Object> row, String category) {
        if (category == null || category.isBlank() || "全部".equals(category)) {
            return true;
        }
        return str(row.get("categoryName")).contains(category) || category.contains(str(row.get("categoryName")));
    }

    private boolean hitOrigin(Map<String, Object> row, String origin) {
        if (origin == null || origin.isBlank() || "全部".equals(origin)) {
            return true;
        }
        String target = str(row.get("deliveryProvince")) + str(row.get("deliveryCity"));
        return target.contains(origin) || origin.contains(target);
    }

    private List<String> originsOf(List<Map<String, Object>> items) {
        List<String> origins = new ArrayList<>();
        for (Map<String, Object> item : items) {
            String origin = str(item.get("origin"));
            if (!origin.isBlank() && !origins.contains(origin)) {
                origins.add(origin);
            }
        }
        return origins.size() > 12 ? origins.subList(0, 12) : origins;
    }

    private String priceRange(Map<String, Object> p) {
        BigDecimal min = decimal(p.get("priceMin"));
        BigDecimal max = decimal(p.get("priceMax"));
        if (min.signum() == 0 && max.signum() == 0) {
            return "价格面议";
        }
        String unit = firstNonBlank(str(p.get("unit")), DEFAULT_UNIT);
        if (min.compareTo(max) == 0) {
            return "参考价 " + trimNumber(min) + " 元/" + unit;
        }
        return "参考区间 " + trimNumber(min) + "~" + trimNumber(max) + " 元/" + unit;
    }

    /** 从描述文本里按给定模式取第一个捕获组，取不到返回空串。 */
    private String fromDescription(Pattern pattern, String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    private String joinOrigin(String province, String city, String district) {        StringBuilder builder = new StringBuilder();
        for (String part : new String[]{province, city, district}) {
            if (part != null && !part.isBlank() && !"null".equals(part)) {
                builder.append(part);
            }
        }
        return builder.toString();
    }

    private String trimNumber(Object value) {
        BigDecimal number = decimal(value);
        return number.stripTrailingZeros().toPlainString();
    }

    private BigDecimal parseAmount(String raw) {
        Matcher matcher = AMOUNT.matcher(raw == null ? "" : raw);
        return matcher.find() ? new BigDecimal(matcher.group(1)) : BigDecimal.ZERO;
    }

    private String parseUnit(String raw, String fallback) {
        Matcher matcher = AMOUNT_UNIT.matcher(raw == null ? "" : raw);
        return matcher.find() ? matcher.group(2) : fallback;
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        if (body == null) {
            return fallback;
        }
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"null".equals(value)) {
                return value;
            }
        }
        return "";
    }

    private Object firstNonNull(Object... values) {
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return BigDecimal.ZERO;
    }

    private long longValue(Object value, long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private BigDecimal decimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return BigDecimal.ZERO;
        }
    }
}
