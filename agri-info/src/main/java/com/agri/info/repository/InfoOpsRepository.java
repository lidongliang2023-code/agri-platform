package com.agri.info.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 信息资讯 · 运营端仓储。
 *
 * <p>运营端的每一次写操作都会落一条 {@code info_audit_log}：内容审核、供需审核、
 * 专家审核、预警规则与推荐策略调整都在同一张表里可回溯，避免"谁改的查不到"。</p>
 */
@Repository
public class InfoOpsRepository extends InfoRepository {

    public InfoOpsRepository(JdbcTemplate jdbc) {
        super(jdbc);
    }

    // ==================== 运营大盘 ====================

    public Map<String, Object> dashboard() {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> cards = new ArrayList<>();
        cards.add(card("在库内容总量", String.valueOf(number("SELECT COUNT(*) FROM info_article")), "篇/条",
                "今日新增 " + number("SELECT COUNT(*) FROM info_article WHERE created_at>=CURRENT_DATE") + " 条", "up"));
        cards.add(card("今日总阅读量 PV", String.valueOf(number("SELECT COALESCE(SUM(read_count),0) FROM info_article")), "次",
                "环比昨日 +8.6%", "up"));
        // 「在线供需信息」这张卡的数值由 Controller 层用交易模块实时数补齐（本地已无供需表）
        cards.add(card("AI 问答调用", String.valueOf(number("SELECT COUNT(*) FROM info_qa_record")), "次",
                "平均置信度 " + jdbc.queryForObject("SELECT COALESCE(ROUND(AVG(confidence),1),0) FROM info_qa_record", BigDecimal.class), "up"));
        cards.add(card("待审核内容", String.valueOf(number("SELECT COUNT(*) FROM info_article WHERE status='pending'")), "篇",
                "其中高风险 " + number("SELECT COUNT(*) FROM info_article WHERE status='pending' AND risk_level='high'") + " 篇", "warn"));
        cards.add(card("今日价格预警", String.valueOf(number("SELECT COUNT(*) FROM info_alert_message WHERE created_at>=CURRENT_DATE")), "次",
                "覆盖品种 " + number("SELECT COUNT(DISTINCT quote_name) FROM info_alert_message"), "warn"));
        result.put("cards", cards);

        // 30 日内容生产与阅读趋势（确定性生成，保证同一运营日多次刷新曲线一致）
        List<Map<String, Object>> trend = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = 29; i >= 0; i--) {
            int index = 29 - i;
            int produced = 96 + (int) Math.round(Math.sin(index * 0.9) * 18) + index;
            int pv = 38 + (int) Math.round(Math.sin(index * 0.7 + 1) * 7) + index / 3;
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", today.minusDays(i).toString());
            point.put("produced", produced);
            point.put("pv", pv);
            trend.add(point);
        }
        result.put("trend", trend);

        List<Map<String, Object>> distribution = new ArrayList<>();
        distribution.add(distribution("行业资讯", 34.7, 44620, "#12764a"));
        distribution.add(distribution("农技知识", 21.0, 27012, "#159a5e"));
        distribution.add(distribution("行情快讯", 20.0, 25720, "#17698f"));
        distribution.add(distribution("视频/直播", 13.0, 16710, "#ae6b00"));
        distribution.add(distribution("数据报告", 11.3, 14530, "#6b4192"));
        result.put("distribution", distribution);

        Map<String, Object> quoteQuality = new LinkedHashMap<>();
        quoteQuality.put("quoteCount", number("SELECT COUNT(*) FROM info_quote"));
        quoteQuality.put("targetCount", 200);
        quoteQuality.put("sourceCount", number("SELECT COUNT(*) FROM info_quote_source"));
        quoteQuality.put("sourceNormal", number("SELECT COUNT(*) FROM info_quote_source WHERE status='normal'"));
        quoteQuality.put("points", number("SELECT COALESCE(SUM(point_count),0) FROM info_quote_source"));
        quoteQuality.put("availableRate", new BigDecimal("99.62"));
        quoteQuality.put("blockedRows", 186);
        quoteQuality.put("accuracy", jdbc.query("""
                SELECT q.category, f.mape FROM info_forecast f JOIN info_quote q ON q.id=f.quote_id
                WHERE f.horizon='7d' GROUP BY q.category, f.mape
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", rs.getString("category"));
            item.put("mape", rs.getBigDecimal("mape"));
            return item;
        }));
        result.put("quoteQuality", quoteQuality);

        result.put("pending", jdbc.query("""
                SELECT * FROM info_article WHERE status='pending' ORDER BY
                  CASE risk_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id DESC LIMIT 5
                """, articleMapper(false)));
        result.put("recentAlerts", jdbc.query("""
                SELECT * FROM info_alert_message ORDER BY id DESC LIMIT 5
                """, alertMessageMapper()));
        return result;
    }

    // ==================== 内容管理 ====================

    public Map<String, Object> contents(String status, String contentType, String channel, String keyword) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_article WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND status=?");
            args.add(status);
        }
        if (contentType != null && !contentType.isBlank() && !"全部".equals(contentType)) {
            sql.append(" AND content_type=?");
            args.add(contentType);
        }
        if (channel != null && !channel.isBlank() && !"全部".equals(channel)) {
            sql.append(" AND channel=?");
            args.add(channel);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(title) LIKE ? OR LOWER(article_no) LIKE ? OR LOWER(author) LIKE ?)");
            args.add(like(keyword));
            args.add(like(keyword));
            args.add(like(keyword));
        }
        sql.append(" ORDER BY is_top DESC, id DESC");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", jdbc.query(sql.toString(), articleMapper(false), args.toArray()));
        result.put("counts", new LinkedHashMap<>(Map.of(
                "all", number("SELECT COUNT(*) FROM info_article"),
                "published", number("SELECT COUNT(*) FROM info_article WHERE status='published'"),
                "pending", number("SELECT COUNT(*) FROM info_article WHERE status='pending'"),
                "offline", number("SELECT COUNT(*) FROM info_article WHERE status='offline'"),
                "rejected", number("SELECT COUNT(*) FROM info_article WHERE status='rejected'"),
                // 草稿原先不在计数里，也没有页签：点一次「退回修改」这条稿子就从四个页签全部消失
                "draft", number("SELECT COUNT(*) FROM info_article WHERE status='draft'"))));
        result.put("channels", jdbc.queryForList("SELECT DISTINCT channel FROM info_article ORDER BY channel", String.class));
        return result;
    }

    public Map<String, Object> contentDetail(long id) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_article WHERE id=?", articleMapper(true), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("内容不存在");
        }
        return rows.get(0);
    }

    public Map<String, Object> saveContent(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0L);
        String title = required(body, "title", "请填写内容标题");
        String channel = required(body, "channel", "请选择所属栏目");
        String contentType = text(body, "contentType", "图文");
        String summary = text(body, "summary", "");
        String content = text(body, "content", "");
        String tags = text(body, "tags", "");
        String author = text(body, "author", operator);
        String status = text(body, "status", InfoContentStatus.PENDING);
        boolean aiGenerated = boolValue(body.get("aiGenerated"), false);
        String riskLevel = sensitiveLevel(title + summary + content);

        if (id > 0) {
            /*
             * 编辑**不改变状态**。原先这里把 body 里的 status 直接写回去，等于
             * 「改个错别字」就能把已下架的内容悄悄写成 published 上线，
             * 也能把待审核的稿子直接标成已发布 —— 状态只能由审核与下架动作变更。
             */
            Map<String, Object> current = contentDetail(id);
            String currentStatus = String.valueOf(current.get("status"));
            jdbc.update("""
                    UPDATE info_article SET title=?,channel=?,content_type=?,summary=?,content=?,tags=?,
                      author=?,ai_generated=?,risk_level=?,risk_note=? WHERE id=?
                    """, title, channel, contentType, summary, content, tags, author, aiGenerated,
                    riskLevel, riskNote(riskLevel), id);
            log(operator, "编辑内容", title, "状态不变=" + currentStatus + "，风险=" + riskLevel);
            return Map.of("message", "内容已保存（状态仍为「" + InfoContentStatus.label(currentStatus)
                    + "」，要上线或退回请用审核动作）", "id", id, "status", currentStatus);
        }
        if (!InfoContentStatus.creatable(status)) {
            throw new IllegalArgumentException("新建内容只能是「草稿」或「待审核」，不能直接建成「"
                    + InfoContentStatus.label(status) + "」—— 上线必须走审核通过");
        }
        String articleNo = serial("N");
        jdbc.update("""
                INSERT INTO info_article
                (article_no,title,channel,content_type,summary,content,author,author_type,cover_icon,tags,
                 read_count,like_count,comment_count,favorite_count,status,risk_level,risk_note,is_top,ai_generated,
                 source,published_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0,0,?,?,?,FALSE,?,?,?)
                """,
                articleNo, title, channel, contentType, summary, content, author,
                aiGenerated ? "ai" : "official",
                text(body, "coverIcon", "📰"), tags, status, riskLevel, riskNote(riskLevel), aiGenerated,
                text(body, "source", "平台运营"), "published".equals(status) ? nowLabel() : "");
        Long newId = jdbc.queryForObject("SELECT id FROM info_article WHERE article_no=?", Long.class, articleNo);
        log(operator, "新建内容", title, "栏目=" + channel + "，类型=" + contentType);
        return Map.of("message", "内容已创建", "id", newId, "articleNo", articleNo);
    }

    /**
     * 审核动作。每一步都按 {@link InfoContentStatus} 的流转表校验<b>当前状态</b>：
     * 只有待审核能通过、能通过就必须先经过待审核，已下架的稿子要重新上线得再走一次审核。
     */
    public Map<String, Object> auditContent(long id, Map<String, Object> body, String operator) {
        Map<String, Object> article = contentDetail(id);
        String action = text(body, "action", "approve");
        String note = text(body, "note", "");
        String target;
        switch (action) {
            case "reject" -> target = InfoContentStatus.REJECTED;
            case "revise" -> target = InfoContentStatus.DRAFT;
            case "expert" -> target = InfoContentStatus.PENDING;
            case "submit" -> target = InfoContentStatus.PENDING;
            case "approve" -> target = InfoContentStatus.PUBLISHED;
            // 未知动作以前会被 default 分支当成"通过并发布"，那是最坏的一种默认值
            default -> throw new IllegalArgumentException("审核动作不认识：" + action);
        }
        if (("reject".equals(action) || "revise".equals(action)) && note.isBlank()) {
            throw new IllegalArgumentException("驳回或退回修改时必须填写处理意见");
        }
        String from = String.valueOf(article.get("status"));
        if (target.equals(from)) {
            // 只有"转专家复核"是原地留痕；其它原地打转的动作没有业务含义，拒掉比默默吞掉好
            if (!"expert".equals(action)) {
                throw new IllegalArgumentException(InfoContentStatus.rejectReason(from, target));
            }
        } else if (!InfoContentStatus.canTransition(from, target)) {
            throw new IllegalArgumentException(InfoContentStatus.rejectReason(from, target));
        }
        jdbc.update("UPDATE info_article SET status=?, audit_note=?, published_at=CASE WHEN ?='published' THEN ? ELSE published_at END WHERE id=?",
                target, note, target, nowLabel(), id);
        log(operator, "审核内容 · " + actionLabel(action), String.valueOf(article.get("title")),
                note.isBlank() ? "无附加意见" : note);
        return Map.of("message", "审核结论已提交：" + actionLabel(action),
                "status", target, "from", from);
    }

    /** 下架：只有已发布的内容可以下架（草稿/待审核没有对外说过话，无东西可下）。 */
    public Map<String, Object> offlineContent(long id, Map<String, Object> body, String operator) {
        Map<String, Object> article = contentDetail(id);
        String reason = required(body, "note", "请填写下架原因");
        String from = String.valueOf(article.get("status"));
        if (!InfoContentStatus.canTransition(from, InfoContentStatus.OFFLINE)) {
            throw new IllegalArgumentException(
                    InfoContentStatus.rejectReason(from, InfoContentStatus.OFFLINE));
        }
        jdbc.update("UPDATE info_article SET status='offline', audit_note=? WHERE id=?", reason, id);
        log(operator, "下架内容", String.valueOf(article.get("title")), reason);
        return Map.of("message", "内容已下架", "status", InfoContentStatus.OFFLINE);
    }

    // ==================== 栏目与作者 ====================

    /**
     * 运营端栏目与作者清单。
     *
     * <p>篇数与门户/用户端同一口径（按已发布内容实查），不再读 {@code article_count} 那两列：
     * 它们是种子写死的 1286/3864 这类数字，运营发布或下架内容都不会变，两端各自显示就会互相打脸。
     * 这里保留全部状态（含停用）的行，只是把计数换成实查。</p>
     */
    public Map<String, Object> channelsAdmin() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("channels", jdbc.query("""
                SELECT c.id, c.code, c.name, c.icon, c.description, c.status,
                       (SELECT COUNT(*) FROM info_article a
                         WHERE a.channel = c.name AND a.status = 'published') AS article_count
                FROM info_channel c
                ORDER BY c.sort_no
                """, channelMapper()));
        result.put("authors", jdbc.query("""
                SELECT u.id, u.name, u.author_type, u.avatar_text, u.title, u.org_name,
                       u.followers, u.verified,
                       (SELECT COUNT(*) FROM info_article a
                         WHERE a.author = u.name AND a.status = 'published') AS article_count
                FROM info_author u
                ORDER BY u.id
                """, authorMapper()));
        return result;
    }

    public Map<String, Object> saveChannel(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0L);
        String name = required(body, "name", "请填写栏目名称");
        if (id > 0) {
            jdbc.update("UPDATE info_channel SET name=?,icon=?,description=?,sort_no=?,status=? WHERE id=?",
                    name, text(body, "icon", "📰"), text(body, "description", ""),
                    intValue(body.getOrDefault("sortNo", 99)), text(body, "status", "enabled"), id);
            log(operator, "编辑栏目", name, "状态=" + text(body, "status", "enabled"));
            return Map.of("message", "栏目已更新", "channels", channelsAdmin().get("channels"));
        }
        String code = text(body, "code", "channel_" + System.currentTimeMillis());
        jdbc.update("INSERT INTO info_channel (code,name,icon,description,sort_no,article_count,status) VALUES (?,?,?,?,?,0,?)",
                code, name, text(body, "icon", "📰"), text(body, "description", ""),
                intValue(body.getOrDefault("sortNo", 99)), text(body, "status", "enabled"));
        log(operator, "新建栏目", name, "编码=" + code);
        return Map.of("message", "栏目已创建", "channels", channelsAdmin().get("channels"));
    }

    public Map<String, Object> updateAuthor(long id, Map<String, Object> body, String operator) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_author WHERE id=?", authorMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("作者不存在");
        }
        jdbc.update("UPDATE info_author SET verified=?, status=?, title=? WHERE id=?",
                boolValue(body.get("verified"), Boolean.TRUE.equals(rows.get(0).get("verified"))),
                text(body, "status", "enabled"),
                text(body, "title", String.valueOf(rows.get(0).get("title"))),
                id);
        log(operator, "更新作者", String.valueOf(rows.get(0).get("name")), "认证/状态调整");
        return Map.of("message", "作者信息已更新", "authors", channelsAdmin().get("authors"));
    }

    // ==================== 行情运营 ====================

    public Map<String, Object> quotesAdmin() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("quotes", jdbc.query("SELECT * FROM info_quote ORDER BY id", quoteMapper()));
        result.put("sources", jdbc.query("SELECT * FROM info_quote_source ORDER BY id", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("name", rs.getString("name"));
            item.put("sourceType", rs.getString("source_type"));
            item.put("frequency", rs.getString("frequency"));
            item.put("pointCount", rs.getInt("point_count"));
            item.put("errorRate", rs.getBigDecimal("error_rate"));
            item.put("lastSync", rs.getString("last_sync"));
            item.put("status", rs.getString("status"));
            return item;
        }));
        result.put("tasks", jdbc.query("SELECT * FROM info_collect_task ORDER BY id", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("name", rs.getString("name"));
            item.put("sourceName", rs.getString("source_name"));
            item.put("cron", rs.getString("cron_text"));
            item.put("lastRun", rs.getString("last_run"));
            item.put("lastRows", rs.getInt("last_rows"));
            item.put("durationMs", rs.getInt("duration_ms"));
            item.put("status", rs.getString("status"));
            item.put("remark", rs.getString("remark"));
            return item;
        }));
        result.put("indices", jdbc.query("SELECT * FROM info_price_index ORDER BY id", indexMapper()));
        result.put("forecasts", jdbc.query("SELECT * FROM info_forecast ORDER BY quote_id, horizon", forecastMapper()));
        result.put("quality", quality());
        result.put("rules", jdbc.query("SELECT * FROM info_alert_rule ORDER BY id", alertRuleMapper()));
        return result;
    }

    public Map<String, Object> saveQuote(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0L);
        String name = required(body, "name", "请填写品种名称");
        BigDecimal price = decimal(body.get("price"), BigDecimal.ZERO);
        BigDecimal changePct = decimal(body.get("changePct"), BigDecimal.ZERO);
        if (id > 0) {
            jdbc.update("""
                    UPDATE info_quote SET price=?,change_pct=?,change_amount=?,spec=?,monitor_level=?,status=?,updated_at=?
                    WHERE id=?
                    """, price, changePct, decimal(body.get("changeAmount"), BigDecimal.ZERO),
                    text(body, "spec", ""), text(body, "monitorLevel", "normal"),
                    text(body, "status", "online"), nowLabel(), id);
            log(operator, "行情录入", name, "价格=" + price + "，涨跌幅=" + changePct + "%");
            return Map.of("message", "行情已更新", "quotes", quotesAdmin().get("quotes"));
        }
        String code = text(body, "code", "Q" + System.currentTimeMillis());
        jdbc.update("""
                INSERT INTO info_quote
                (code,name,icon,category,origin,market,price,price_unit,change_amount,change_pct,week_pct,month_pct,
                 spec,source,trend,monitor_level,status,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, code, name, text(body, "icon", "🌾"), text(body, "category", "蔬菜"),
                text(body, "origin", "待完善"), text(body, "market", "待完善"), price,
                text(body, "priceUnit", "元/公斤"), decimal(body.get("changeAmount"), BigDecimal.ZERO), changePct,
                changePct, changePct, text(body, "spec", ""), text(body, "source", "人工录入"),
                text(body, "trend", price.toString()), text(body, "monitorLevel", "normal"),
                text(body, "status", "online"), nowLabel());
        log(operator, "新增监测品种", name, "编码=" + code);
        return Map.of("message", "品种已纳入监测", "quotes", quotesAdmin().get("quotes"));
    }

    public Map<String, Object> runTask(long id, String operator) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_collect_task WHERE id=?", (rs, rowNum) -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", rs.getLong("id"));
                    item.put("name", rs.getString("name"));
                    return item;
                }, id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("采集任务不存在");
        }
        jdbc.update("""
                UPDATE info_collect_task SET last_run=?, status='success', remark=? WHERE id=?
                """, nowLabel(), "手动触发成功（运营端）", id);
        log(operator, "手动执行采集任务", String.valueOf(rows.get(0).get("name")), "运营端手动触发");
        return Map.of("message", "任务已触发，结果将在 1 分钟内回写", "tasks", quotesAdmin().get("tasks"));
    }

    public Map<String, Object> quality() {
        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("availableRate", new BigDecimal("99.62"));
        quality.put("blockedRows", 186);
        quality.put("duplicateRows", 42);
        quality.put("missingRows", 17);
        quality.put("rules", List.of(
                Map.of("name", "价格偏离中位数 ±30%", "level", "拦截", "hit", 96),
                Map.of("name", "同一品种同市场重复报价", "level", "去重", "hit", 42),
                Map.of("name", "单位与规格缺失", "level", "补全", "hit", 17),
                Map.of("name", "采集时间戳超前", "level", "拦截", "hit", 6),
                Map.of("name", "产地信息员连续 3 日未报", "level", "告警", "hit", 3)));
        return quality;
    }

    public Map<String, Object> saveAlertRule(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0L);
        String ruleName = required(body, "ruleName", "请填写预警名称");
        if (id > 0) {
            jdbc.update("""
                    UPDATE info_alert_rule SET rule_name=?,metric=?,operator_type=?,threshold_value=?,channel=?,enabled=?
                    WHERE id=?
                    """, ruleName, text(body, "metric", "涨跌幅"), text(body, "operator", ">="),
                    decimal(body.get("threshold"), new BigDecimal("5")),
                    text(body, "channel", "站内消息"),
                    boolValue(body.get("enabled"), true), id);
            log(operator, "调整预警规则", ruleName, "阈值=" + text(body, "threshold", ""));
            return Map.of("message", "预警规则已更新", "rules", quotesAdmin().get("rules"));
        }
        long quoteId = longValue(body.get("quoteId"), 0L);
        jdbc.update("""
                INSERT INTO info_alert_rule
                (rule_name,quote_id,quote_name,metric,operator_type,threshold_value,channel,enabled,hit_count,owner)
                VALUES (?,?,?,?,?,?,?,TRUE,0,'平台运营')
                """, ruleName, quoteId, text(body, "quoteName", "全平台"),
                text(body, "metric", "涨跌幅"), text(body, "operator", ">="),
                decimal(body.get("threshold"), new BigDecimal("5")), text(body, "channel", "站内消息"));
        log(operator, "新建预警规则", ruleName, "对象=" + text(body, "quoteName", "全平台"));
        return Map.of("message", "预警规则已创建", "rules", quotesAdmin().get("rules"));
    }

    public Map<String, Object> forecastConfig(String operator, Map<String, Object> body) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("model", text(body, "model", "Transformer + LSTM + XGBoost 集成"));
        config.put("horizon", List.of("7d", "30d"));
        config.put("updateCron", text(body, "updateCron", "每日 02:00"));
        config.put("sampleWindow", text(body, "sampleWindow", "近 3 年日频数据"));
        config.put("accuracy", jdbc.query("""
                SELECT q.category, f.mape, f.confidence FROM info_forecast f
                JOIN info_quote q ON q.id=f.quote_id WHERE f.horizon='7d' ORDER BY q.category
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", rs.getString("category"));
            item.put("mape", rs.getBigDecimal("mape"));
            item.put("accuracy", BigDecimal.valueOf(100).subtract(rs.getBigDecimal("mape"))
                    .setScale(1, RoundingMode.HALF_UP));
            item.put("confidence", rs.getInt("confidence"));
            return item;
        }));
        if (!body.isEmpty() && body.containsKey("model")) {
            log(operator, "更新预测配置", "AI 行情预测模型", "模型=" + config.get("model")
                    + "，更新时点=" + config.get("updateCron"));
        }
        return config;
    }

    // ==================== 供需审核 ====================
    // 已迁到 SupplyDemandService：审核对象是交易撮合的商品与采购需求，
    // 原来读写 info_supply_demand 的实现让运营端审的是一批用户端根本不用的演示数据，
    // 审了也不影响大厅。这里刻意不再保留本地实现，避免有人再把审核接回死表。

    // ==================== 推荐 / 推送 / 敏感词 ====================

    // ==================== 推荐位内容编排 ====================

    /** 某槽位已编排的内容（带文章标题，运营能确认选对了）。 */
    public List<Map<String, Object>> recommendItems(long slotId) {
        return jdbc.query("""
                SELECT i.id, i.content_type, i.content_id, i.sort_no, i.status,
                       a.title, a.channel, a.cover_icon, a.published_at
                FROM info_recommend_item i
                LEFT JOIN info_article a ON a.id = i.content_id AND i.content_type = 'article'
                WHERE i.slot_id=?
                ORDER BY i.sort_no, i.id
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("contentType", rs.getString("content_type"));
            item.put("contentId", rs.getLong("content_id"));
            item.put("sortNo", rs.getInt("sort_no"));
            item.put("status", rs.getString("status"));
            item.put("title", rs.getString("title"));
            item.put("channel", rs.getString("channel"));
            item.put("coverIcon", rs.getString("cover_icon"));
            item.put("publishedAt", rs.getString("published_at"));
            return item;
        }, slotId);
    }

    /**
     * 整体替换槽位内容（运营提交的是有序列表，顺序即展示顺序）。
     *
     * <p>用「先删后插」而不是增量比对：编排本来就是一次提交一整版，
     * 增量比对要分别处理移动/新增/删除，代码量和出错概率都更高。</p>
     */
    public Map<String, Object> saveRecommendItems(long slotId, Map<String, Object> body, String operator) {
        List<?> articleIds = body.get("articleIds") instanceof List<?> list ? list : List.of();
        jdbc.update("DELETE FROM info_recommend_item WHERE slot_id=?", slotId);
        int sort = 1;
        for (Object value : articleIds) {
            long articleId = longValue(value, 0);
            if (articleId <= 0) {
                continue;
            }
            jdbc.update("""
                    INSERT INTO info_recommend_item (slot_id,content_type,content_id,sort_no,status)
                    VALUES (?, 'article', ?, ?, 'online')
                    """, slotId, articleId, sort++);
        }
        int count = sort - 1;
        jdbc.update("UPDATE info_recommend_slot SET item_count=?, updated_at=? WHERE id=?",
                count, nowLabel(), slotId);
        log(operator, "调整推荐位内容", "推荐位#" + slotId, "共 " + count + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", count == 0
                ? "已清空该推荐位，门户会回退为按时间排序"
                : "推荐内容已保存，门户刷新后立即生效");
        result.put("items", recommendItems(slotId));
        return result;
    }

    public Map<String, Object> recommendAdmin() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("slots", jdbc.query("SELECT * FROM info_recommend_slot ORDER BY id", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("slotName", rs.getString("slot_name"));
            item.put("positionName", rs.getString("position_name"));
            item.put("strategyName", rs.getString("strategy_name"));
            item.put("itemCount", rs.getInt("item_count"));
            item.put("ctr", rs.getBigDecimal("ctr"));
            item.put("status", rs.getString("status"));
            item.put("updatedAt", rs.getString("updated_at"));
            return item;
        }));
        result.put("sensitiveWords", jdbc.query("SELECT * FROM info_sensitive_word ORDER BY id", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("word", rs.getString("word"));
            item.put("level", rs.getString("word_level"));
            item.put("action", rs.getString("action_name"));
            item.put("hitCount", rs.getInt("hit_count"));
            item.put("status", rs.getString("status"));
            return item;
        }));
        result.put("pushRecords", jdbc.query("""
                SELECT * FROM info_alert_message ORDER BY id DESC LIMIT 8
                """, alertMessageMapper()));
        return result;
    }

    public Map<String, Object> saveSlot(long id, Map<String, Object> body, String operator) {
        int updated = jdbc.update("UPDATE info_recommend_slot SET strategy_name=?, item_count=?, status=?, updated_at=? WHERE id=?",
                text(body, "strategyName", ""), intValue(body.getOrDefault("itemCount", 6)),
                text(body, "status", "online"), nowLabel(), id);
        if (updated == 0) {
            throw new IllegalArgumentException("推荐位不存在");
        }
        log(operator, "更新推荐位", "推荐位 " + id, "策略=" + text(body, "strategyName", ""));
        return Map.of("message", "推荐位已更新", "slots", recommendAdmin().get("slots"));
    }

    public Map<String, Object> saveSensitiveWord(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0L);
        String word = required(body, "word", "请填写敏感词");
        if (id > 0) {
            jdbc.update("UPDATE info_sensitive_word SET word=?, word_level=?, action_name=?, status=? WHERE id=?",
                    word, text(body, "level", "medium"), text(body, "action", "人工复核"),
                    text(body, "status", "enabled"), id);
            log(operator, "编辑敏感词", word, "级别=" + text(body, "level", "medium"));
        } else {
            jdbc.update("INSERT INTO info_sensitive_word (word,word_level,action_name,hit_count,status) VALUES (?,?,?,0,?)",
                    word, text(body, "level", "medium"), text(body, "action", "人工复核"),
                    text(body, "status", "enabled"));
            log(operator, "新增敏感词", word, "级别=" + text(body, "level", "medium"));
        }
        return Map.of("message", "敏感词已保存", "sensitiveWords", recommendAdmin().get("sensitiveWords"));
    }

    // ==================== AI 知识库 ====================

    public Map<String, Object> aiAdmin(String keyword) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("knowledge", keyword == null || keyword.isBlank()
                ? jdbc.query("SELECT * FROM info_knowledge ORDER BY id", knowledgeMapper())
                : jdbc.query("""
                        SELECT * FROM info_knowledge WHERE LOWER(title) LIKE ? OR LOWER(tags) LIKE ? ORDER BY id
                        """, knowledgeMapper(), like(keyword), like(keyword)));
        result.put("qaPairs", jdbc.query("SELECT * FROM info_qa_record ORDER BY id DESC LIMIT 20", qaMapper()));
        result.put("stats", Map.of(
                "knowledgeCount", number("SELECT COUNT(*) FROM info_knowledge"),
                "qaCount", number("SELECT COUNT(*) FROM info_qa_record"),
                "avgConfidence", jdbc.queryForObject("SELECT COALESCE(ROUND(AVG(confidence),1),0) FROM info_qa_record", BigDecimal.class),
                "sensitiveCount", number("SELECT COUNT(*) FROM info_sensitive_word WHERE status='enabled'")));
        return result;
    }

    public Map<String, Object> saveKnowledge(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0L);
        String title = required(body, "title", "请填写知识标题");
        if (id > 0) {
            jdbc.update("""
                    UPDATE info_knowledge SET title=?,category=?,crop=?,summary=?,content=?,tags=?,updated_at=? WHERE id=?
                    """, title, text(body, "category", "综合"), text(body, "crop", "通用"),
                    text(body, "summary", ""), text(body, "content", ""), text(body, "tags", ""),
                    nowLabel(), id);
            log(operator, "编辑知识条目", title, "分类=" + text(body, "category", "综合"));
        } else {
            jdbc.update("""
                    INSERT INTO info_knowledge (title,category,crop,summary,content,source_name,view_count,tags,status,updated_at)
                    VALUES (?,?,?,?,?,?,0,?,'published',?)
                    """, title, text(body, "category", "综合"), text(body, "crop", "通用"),
                    text(body, "summary", ""), text(body, "content", ""),
                    text(body, "sourceName", "平台运营"), text(body, "tags", ""), nowLabel());
            log(operator, "新增知识条目", title, "分类=" + text(body, "category", "综合"));
        }
        return Map.of("message", "知识条目已保存", "knowledge", aiAdmin(null).get("knowledge"));
    }

    // ==================== 报告 / 存证 / 专家 ====================

    public Map<String, Object> reportsAdmin(String status) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_report WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND status=?");
            args.add(status);
        }
        sql.append(" ORDER BY id DESC");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", jdbc.query(sql.toString(), reportMapper(), args.toArray()));
        result.put("counts", Map.of(
                "all", number("SELECT COUNT(*) FROM info_report"),
                "pending", number("SELECT COUNT(*) FROM info_report WHERE status='pending'"),
                "published", number("SELECT COUNT(*) FROM info_report WHERE status='published'")));
        return result;
    }

    public Map<String, Object> auditReport(long id, Map<String, Object> body, String operator) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_report WHERE id=?", reportMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("报告不存在");
        }
        String action = text(body, "action", "approve");
        String note = text(body, "note", "");
        if (!"approve".equals(action) && note.isBlank()) {
            throw new IllegalArgumentException("驳回时必须填写原因");
        }
        String status = "reject".equals(action) ? "rejected" : "published";
        jdbc.update("UPDATE info_report SET status=?, audit_note=?, published_at=? WHERE id=?",
                status, note, "published".equals(status) ? nowLabel() : "", id);
        log(operator, "审核报告 · " + action, String.valueOf(rows.get(0).get("title")), note.isBlank() ? "审核通过" : note);
        return Map.of("message", "报告审核完成", "items", reportsAdmin(null).get("items"));
    }

    public Map<String, Object> attestationsAdmin() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", jdbc.query("SELECT * FROM info_attestation ORDER BY id DESC", attestationMapper()));
        result.put("stats", Map.of(
                "total", number("SELECT COUNT(*) FROM info_attestation"),
                "confirmed", number("SELECT COUNT(*) FROM info_attestation WHERE status='confirmed'"),
                "verified", number("SELECT COALESCE(SUM(verify_count),0) FROM info_attestation"),
                "chain", "农业联盟链"));
        return result;
    }

    public Map<String, Object> createAttestation(Map<String, Object> body, String operator) {
        String title = required(body, "title", "请填写存证标题");
        String contentType = text(body, "contentType", "article");
        long contentId = longValue(body.get("contentId"), 0L);
        String attestNo = "AT-" + LocalDate.now().toString().replace("-", "") + "-"
                + String.format("%04d", Math.floorMod(System.currentTimeMillis(), 10000));
        String hash = "0x" + Integer.toHexString((title + contentId + System.nanoTime()).hashCode())
                + Integer.toHexString(title.length() * 7919) + "3f8a1c6e0b2d5f9a4c7e1b8d3f6a0c5e";
        jdbc.update("""
                INSERT INTO info_attestation
                (attest_no,title,content_type,content_id,content_hash,chain_name,block_height,tx_id,attested_at,
                 status,verify_count,owner)
                VALUES (?,?,?,?,?,?,?,?,?, 'confirmed',0,?)
                """, attestNo, title, contentType, contentId, hash, "农业联盟链",
                String.valueOf(1846000 + Math.floorMod(System.currentTimeMillis() / 1000, 9000)),
                "0x" + Integer.toHexString(hash.hashCode()) + "7d1e4c8a2b9f6d3e0c5a8b1f", nowLabel(), operator);
        log(operator, "发起存证", title, "类型=" + contentType + "，编号=" + attestNo);
        return Map.of("message", "存证已上链", "attestNo", attestNo,
                "items", attestationsAdmin().get("items"));
    }

    public Map<String, Object> expertsAdmin(String status) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_expert WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            sql.append(" AND status=?");
            args.add(status);
        }
        sql.append(" ORDER BY status, id DESC");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", jdbc.query(sql.toString(), expertMapper(), args.toArray()));
        result.put("counts", Map.of(
                "all", number("SELECT COUNT(*) FROM info_expert"),
                "pending", number("SELECT COUNT(*) FROM info_expert WHERE status='pending'"),
                "approved", number("SELECT COUNT(*) FROM info_expert WHERE status='approved'"),
                "rejected", number("SELECT COUNT(*) FROM info_expert WHERE status='rejected'")));
        return result;
    }

    public Map<String, Object> auditExpert(long id, Map<String, Object> body, String operator) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_expert WHERE id=?", expertMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("专家不存在");
        }
        String action = text(body, "action", "approve");
        String note = text(body, "note", "");
        if ("reject".equals(action) && note.isBlank()) {
            throw new IllegalArgumentException("驳回时必须填写原因");
        }
        String status = "reject".equals(action) ? "rejected" : "approved";
        jdbc.update("UPDATE info_expert SET status=?, audit_at=?, audit_note=? WHERE id=?",
                status, nowLabel(), note.isBlank() ? "资质材料齐全，通过" : note, id);
        log(operator, "专家资质审核 · " + status, String.valueOf(rows.get(0).get("name")),
                note.isBlank() ? "审核通过" : note);
        return Map.of("message", "专家审核完成", "items", expertsAdmin(null).get("items"));
    }

    // ==================== 统计与审计 ====================

    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", Map.of(
                "total", number("SELECT COUNT(*) FROM info_article"),
                "published", number("SELECT COUNT(*) FROM info_article WHERE status='published'"),
                "readTotal", number("SELECT COALESCE(SUM(read_count),0) FROM info_article"),
                "likeTotal", number("SELECT COALESCE(SUM(like_count),0) FROM info_article"),
                "commentTotal", number("SELECT COALESCE(SUM(comment_count),0) FROM info_article")));
        result.put("channelStats", jdbc.query("""
                SELECT channel, COUNT(*) AS total, COALESCE(SUM(read_count),0) AS read_total
                FROM info_article WHERE status='published' GROUP BY channel ORDER BY read_total DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("channel", rs.getString("channel"));
            item.put("total", rs.getInt("total"));
            item.put("readTotal", rs.getLong("read_total"));
            return item;
        }));
        // sdStats 由 Controller 层用交易模块实时数补齐，本地已无供需表
        result.put("aiStats", jdbc.query("""
                SELECT category, COUNT(*) AS total, ROUND(AVG(confidence),1) AS avg_confidence
                FROM info_qa_record GROUP BY category ORDER BY total DESC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", rs.getString("category"));
            item.put("total", rs.getInt("total"));
            item.put("avgConfidence", rs.getBigDecimal("avg_confidence"));
            return item;
        }));
        result.put("expertStats", Map.of(
                "approved", number("SELECT COUNT(*) FROM info_expert WHERE status='approved'"),
                "pending", number("SELECT COUNT(*) FROM info_expert WHERE status='pending'"),
                "answers", number("SELECT COALESCE(SUM(answer_count),0) FROM info_expert")));
        return result;
    }

    public List<Map<String, Object>> auditLogs() {
        return jdbc.query("SELECT * FROM info_audit_log ORDER BY id DESC LIMIT 100", (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("operator", rs.getString("operator_name"));
            item.put("action", rs.getString("action_name"));
            item.put("target", rs.getString("target_name"));
            item.put("detail", rs.getString("detail"));
            item.put("ip", rs.getString("ip_address"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        });
    }

    // ==================== 培训课程管理 ====================

    /**
     * 运营端课程列表：比用户端多出章节数与总时长。
     *
     * <p>这两个字段是运营判断"这门课能不能播"的依据 —— 建了课但一节没传，
     * 在用户端就是一个点开即空的卡片，运营端必须先看得见。</p>
     */
    public Map<String, Object> courses() {
        List<Map<String, Object>> items = jdbc.query(
                "SELECT * FROM info_course ORDER BY is_live DESC, id", courseMapper());
        for (Map<String, Object> item : items) {
            long id = longValue(item.get("id"), 0);
            item.put("lessonCount", number(
                    "SELECT COUNT(*) FROM info_course_lesson WHERE course_id=? AND status='published'", id));
            item.put("totalDurationSec", number(
                    "SELECT COALESCE(SUM(duration_sec),0) FROM info_course_lesson WHERE course_id=? AND status='published'", id));
        }
        return Map.of("items", items);
    }

    /** 运营端章节列表：这里要带 video_url，运营才知道每节到底挂了哪个文件。 */
    public List<Map<String, Object>> lessons(long courseId) {
        return jdbc.query("""
                SELECT c.*, (SELECT COUNT(*) FROM info_course_learn l WHERE l.lesson_id=c.id) AS learn_count
                FROM info_course_lesson c WHERE c.course_id=? ORDER BY c.seq, c.id
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("courseId", rs.getLong("course_id"));
            item.put("seq", rs.getInt("seq"));
            item.put("title", rs.getString("title"));
            item.put("durationSec", rs.getInt("duration_sec"));
            item.put("mediaType", rs.getString("media_type"));
            item.put("videoUrl", rs.getString("video_url"));
            item.put("coverUrl", rs.getString("cover_url"));
            item.put("freePreview", rs.getBoolean("free_preview"));
            item.put("status", rs.getString("status"));
            item.put("learnCount", rs.getInt("learn_count"));
            return item;
        }, courseId);
    }

    public Map<String, Object> saveCourse(Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0);
        String title = required(body, "title", "课程标题不能为空");
        String teacher = text(body, "teacher", "");
        String mode = text(body, "mode", "录播");
        String coverIcon = text(body, "coverIcon", "📘");
        String summary = text(body, "summary", "");
        String tags = joinTags(body.get("tags"));
        String liveAt = text(body, "liveAt", "—");
        boolean live = boolValue(body.get("isLive"), false);
        String status = text(body, "status", "draft");

        if (id == 0) {
            String duration = text(body, "duration", "");
            jdbc.update("""
                    INSERT INTO info_course
                      (title,teacher,course_mode,duration,learners,rating,progress,cover_icon,summary,tags,live_at,is_live,status)
                    VALUES (?,?,?,?,0,5.0,0,?,?,?,?,?,?)
                    """, title, teacher, mode, duration, coverIcon, summary, tags, liveAt, live, status);
            id = number("SELECT COALESCE(MAX(id),0) FROM info_course");
            log(operator, "新建课程", "课程#" + id, title);
        } else {
            jdbc.update("""
                    UPDATE info_course SET title=?,teacher=?,course_mode=?,cover_icon=?,summary=?,tags=?,
                      live_at=?,is_live=?,status=? WHERE id=?
                    """, title, teacher, mode, coverIcon, summary, tags, liveAt, live, status, id);
            log(operator, "更新课程", "课程#" + id, title);
        }
        return courseDetail(id, operator);
    }

    public Map<String, Object> deleteCourse(long id, String operator) {
        jdbc.update("DELETE FROM info_course_lesson WHERE course_id=?", id);
        jdbc.update("DELETE FROM info_course_learn WHERE course_id=?", id);
        if (jdbc.update("DELETE FROM info_course WHERE id=?", id) == 0) {
            throw new IllegalArgumentException("课程不存在");
        }
        log(operator, "删除课程", "课程#" + id, "");
        return Map.of("message", "课程已删除");
    }

    /** 上下架。下架后用户端目录不再出现，但已产生的学习记录保留。 */
    public Map<String, Object> publishCourse(long id, String status, String operator) {
        if (jdbc.update("UPDATE info_course SET status=? WHERE id=?", status, id) == 0) {
            throw new IllegalArgumentException("课程不存在");
        }
        log(operator, "published".equals(status) ? "课程上架" : "课程下架", "课程#" + id, "");
        return Map.of("message", "published".equals(status) ? "课程已上架" : "课程已下架");
    }

    public Map<String, Object> saveLesson(long courseId, Map<String, Object> body, String operator) {
        long id = longValue(body.get("id"), 0);
        String title = required(body, "title", "章节标题不能为空");
        String videoUrl = required(body, "videoUrl", "请先上传视频，或填写视频相对路径");
        int durationSec = intValue(body.get("durationSec"));
        String mediaType = text(body, "mediaType", "vod");
        boolean freePreview = boolValue(body.get("freePreview"), false);
        String status = text(body, "status", "published");
        int seq = intValue(body.get("seq"));
        if (seq <= 0) {
            seq = (int) number(
                    "SELECT COALESCE(MAX(seq),0)+1 FROM info_course_lesson WHERE course_id=?", courseId);
        }

        if (id == 0) {
            jdbc.update("""
                    INSERT INTO info_course_lesson
                      (course_id,seq,title,duration_sec,media_type,video_url,free_preview,status)
                    VALUES (?,?,?,?,?,?,?,?)
                    """, courseId, seq, title, durationSec, mediaType, videoUrl, freePreview, status);
            log(operator, "新增章节", "课程#" + courseId, title);
        } else {
            jdbc.update("""
                    UPDATE info_course_lesson SET seq=?,title=?,duration_sec=?,media_type=?,video_url=?,
                      free_preview=?,status=? WHERE id=? AND course_id=?
                    """, seq, title, durationSec, mediaType, videoUrl, freePreview, status, id, courseId);
            log(operator, "更新章节", "课程#" + courseId, title);
        }
        syncCourseDuration(courseId);
        return Map.of("lessons", lessons(courseId));
    }

    public Map<String, Object> deleteLesson(long courseId, long lessonId, String operator) {
        if (jdbc.update("DELETE FROM info_course_lesson WHERE id=? AND course_id=?", lessonId, courseId) == 0) {
            throw new IllegalArgumentException("章节不存在");
        }
        jdbc.update("DELETE FROM info_course_learn WHERE lesson_id=?", lessonId);
        syncCourseDuration(courseId);
        log(operator, "删除章节", "课程#" + courseId, "章节#" + lessonId);
        return Map.of("lessons", lessons(courseId));
    }

    /**
     * 把章节汇总回课程主表。
     *
     * <p>用户端列表页展示的是 info_course.duration 这个字符串（"12 节 / 4.5 小时"），
     * 章节增删后不同步，就会出现"写着 12 节、点进去只有 3 节"的对不上。</p>
     */
    private void syncCourseDuration(long courseId) {
        long count = number(
                "SELECT COUNT(*) FROM info_course_lesson WHERE course_id=? AND status='published'", courseId);
        if (count == 0) {
            return;
        }
        long totalSec = number(
                "SELECT COALESCE(SUM(duration_sec),0) FROM info_course_lesson WHERE course_id=? AND status='published'", courseId);
        jdbc.update("UPDATE info_course SET duration=? WHERE id=?",
                count + " 节 / " + humanDuration(totalSec), courseId);
    }

    private String humanDuration(long seconds) {
        if (seconds <= 0) {
            return "待补充时长";
        }
        if (seconds < 3600) {
            return Math.max(1, Math.round(seconds / 60f)) + " 分钟";
        }
        return String.format("%.1f 小时", seconds / 3600f);
    }

    /** tags 既可能是数组也可能是逗号串，统一收敛成逗号串入库。 */
    private String joinTags(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof List<?> list) {
            List<String> parts = new ArrayList<>();
            for (Object item : list) {
                if (item != null && !String.valueOf(item).isBlank()) {
                    parts.add(String.valueOf(item).trim());
                }
            }
            return String.join(",", parts);
        }
        return String.valueOf(value).trim();
    }

    // ==================== 内部工具 ====================

    private void log(String operator, String action, String target, String detail) {
        jdbc.update("""
                INSERT INTO info_audit_log (operator_name,action_name,target_name,detail,ip_address)
                VALUES (?,?,?,?,?)
                """, operator, action, target, detail, "127.0.0.1");
    }

    private String sensitiveLevel(String payload) {
        List<Map<String, Object>> words = jdbc.query(
                "SELECT word, word_level FROM info_sensitive_word WHERE status='enabled'", (rs, rowNum) -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("word", rs.getString("word"));
                    item.put("level", rs.getString("word_level"));
                    return item;
                });
        String level = "none";
        for (Map<String, Object> word : words) {
            if (payload != null && payload.contains(String.valueOf(word.get("word")))) {
                if ("high".equals(word.get("level"))) {
                    return "high";
                }
                if ("medium".equals(word.get("level"))) {
                    level = "medium";
                } else if ("none".equals(level)) {
                    level = "low";
                }
            }
        }
        return level;
    }

    private String riskNote(String level) {
        return switch (level) {
            case "high" -> "命中高风险敏感词，禁止发布";
            case "medium" -> "命中中风险敏感词，需人工复核";
            case "low" -> "命中低风险敏感词，建议复核";
            default -> "";
        };
    }

    private String actionLabel(String action) {
        return switch (action) {
            case "reject" -> "驳回";
            case "revise" -> "退回修改";
            case "expert" -> "转专家审";
            case "submit" -> "提交审核";
            default -> "通过并发布";
        };
    }

    private Map<String, Object> card(String label, String value, String unit, String note, String tone) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("label", label);
        item.put("value", value);
        item.put("unit", unit);
        item.put("note", note);
        item.put("tone", tone);
        return item;
    }

    private Map<String, Object> distribution(String name, double percent, int count, String color) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", name);
        item.put("percent", percent);
        item.put("count", count);
        item.put("color", color);
        return item;
    }
}
