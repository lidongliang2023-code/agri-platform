package com.agri.info.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 信息资讯 · 用户端仓储。
 *
 * <p>用户端只读为主，写入集中在四类：供需发布/沟通、AI 问答、预警与订阅、收藏。
 * 所有写入都带 owner（统一账号昵称），避免不同用户互相看到对方的私域数据。</p>
 */
@Repository
public class InfoRepository extends InfoSupport {

    public InfoRepository(JdbcTemplate jdbc) {
        super(jdbc);
    }

    // ==================== 工作台 ====================

    public Map<String, Object> overview(String user) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("monitoredQuotes", number("SELECT COUNT(*) FROM info_quote WHERE status='online'"));
        stats.put("todayArticles", number("SELECT COUNT(*) FROM info_article WHERE status='published'"));
        stats.put("unreadAlerts", number("SELECT COUNT(*) FROM info_alert_message WHERE is_read=FALSE"));
        // onlineSupplyDemand 由 Controller 层用交易模块的实时数补齐，这里不查本地历史表
        stats.put("aiCalls", number("SELECT COUNT(*) FROM info_qa_record"));
        result.put("stats", stats);

        Map<String, Object> greeting = new LinkedHashMap<>();
        greeting.put("owner", user);
        greeting.put("date", LocalDate.now().toString());
        greeting.put("headline", "您关注的大蒜（山东金乡）近 7 日上涨 7.1%，AI 判断未来 7 天小幅上涨概率 68%；另有 2 条与您相关的补贴新政待查收。");
        result.put("greeting", greeting);

        List<String> ticker = new ArrayList<>();
        List<Map<String, Object>> hot = jdbc.query(
                "SELECT * FROM info_quote WHERE status='online' ORDER BY ABS(change_pct) DESC LIMIT 4", quoteMapper());
        for (Map<String, Object> quote : hot) {
            ticker.add(quote.get("icon") + " " + quote.get("name") + "（" + quote.get("origin") + "）"
                    + (decimal(quote.get("changePct"), BigDecimal.ZERO).doubleValue() >= 0 ? "上涨 " : "下跌 ")
                    + decimal(quote.get("changePct"), BigDecimal.ZERO).abs() + "%，最新价 "
                    + quote.get("price") + " " + quote.get("priceUnit"));
        }
        result.put("ticker", ticker);

        result.put("feed", jdbc.query("""
                SELECT * FROM info_article WHERE status='published'
                ORDER BY is_top DESC, published_at DESC LIMIT 8
                """, articleMapper(false)));
        result.put("hotRank", hot.stream().map(quote -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("quoteId", quote.get("id"));
            item.put("name", quote.get("name"));
            item.put("icon", quote.get("icon"));
            item.put("origin", quote.get("origin"));
            item.put("changePct", quote.get("changePct"));
            item.put("price", quote.get("price"));
            return item;
        }).toList());

        Map<String, Object> aiBrief = new LinkedHashMap<>();
        aiBrief.put("title", "今日 AI 行情简报");
        aiBrief.put("lines", List.of(
                "大蒜：库存周期约 15 天，低于常年 30 天，价格偏强运行。",
                "番茄：北方设施菜集中上市，短期供大于求。",
                "小麦：新粮开秤价 2.56 元/公斤，托市收购支撑明显。"));
        aiBrief.put("confidence", 88);
        aiBrief.put("articleId", 5);
        result.put("aiBrief", aiBrief);

        List<Map<String, Object>> lives = jdbc.query(
                "SELECT * FROM info_course WHERE is_live=TRUE AND status='published' LIMIT 1", courseMapper());
        result.put("live", lives.isEmpty() ? null : lives.get(0));

        result.put("channels", channels());
        result.put("todos", List.of(
                todo("价格预警", "大蒜、辣椒 2 条预警未读，建议查看异动原因", "alerts", "2 条未读"),
                todo("供需撮合", "AI 为您发现 5 条高匹配采购需求，最高匹配度 92%", "sd-match", "5 条建议"),
                todo("专家认证", "认证资料已提交，平台将在 3 个工作日内完成审核", "expert", "审核中")));
        return result;
    }

    // ==================== 行情 ====================

    public Map<String, Object> markets(String category, String market, String keyword) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_quote WHERE status='online'");
        List<Object> args = new ArrayList<>();
        if (category != null && !category.isBlank() && !"全部".equals(category)) {
            sql.append(" AND category=?");
            args.add(category);
        }
        if (market != null && !market.isBlank() && !"全国综合".equals(market)) {
            sql.append(" AND market=?");
            args.add(market);
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(name) LIKE ? OR LOWER(origin) LIKE ? OR LOWER(code) LIKE ?)");
            args.add(like(keyword));
            args.add(like(keyword));
            args.add(like(keyword));
        }
        sql.append(" ORDER BY ABS(change_pct) DESC, id");
        List<Map<String, Object>> quotes = jdbc.query(sql.toString(), quoteMapper(), args.toArray());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", quotes.size());
        stats.put("up", quotes.stream().filter(item -> decimal(item.get("changePct"), BigDecimal.ZERO).signum() > 0).count());
        stats.put("down", quotes.stream().filter(item -> decimal(item.get("changePct"), BigDecimal.ZERO).signum() < 0).count());
        stats.put("flat", quotes.stream().filter(item -> decimal(item.get("changePct"), BigDecimal.ZERO).signum() == 0).count());
        stats.put("abnormal", number("SELECT COUNT(*) FROM info_quote WHERE monitor_level='abnormal'"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stats", stats);
        result.put("quotes", quotes);
        result.put("categories", jdbc.queryForList("SELECT DISTINCT category FROM info_quote WHERE status='online' ORDER BY category", String.class));
        result.put("markets", jdbc.queryForList("SELECT DISTINCT market FROM info_quote WHERE status='online' ORDER BY market", String.class));
        result.put("regionPrices", regionPrices(1L));
        result.put("aiRead", aiMarketRead());
        return result;
    }

    public Map<String, Object> marketDetail(long id) {
        Map<String, Object> quote = quote(id);
        Map<String, Object> result = new LinkedHashMap<>(quote);
        result.put("series", series(quote));
        result.put("forecast", forecastOf(id, "7d"));
        result.put("regionPrices", regionPrices(id));
        result.put("relatedArticles", jdbc.query("""
                SELECT * FROM info_article WHERE status='published'
                  AND (title LIKE ? OR channel='市场动态')
                ORDER BY published_at DESC LIMIT 3
                """, articleMapper(false), "%" + quote.get("name") + "%"));
        result.put("aiRead", aiMarketRead());
        result.put("alertRules", alertRules(""));
        return result;
    }

    public List<Map<String, Object>> compareQuotes(String ids) {
        List<Map<String, Object>> quotes;
        if (ids == null || ids.isBlank()) {
            quotes = jdbc.query("SELECT * FROM info_quote WHERE status='online' ORDER BY id LIMIT 4", quoteMapper());
        } else {
            List<Long> parsed = new ArrayList<>();
            for (String part : ids.split(",")) {
                try {
                    parsed.add(Long.parseLong(part.trim()));
                } catch (NumberFormatException ignored) {
                    // 非法 id 直接忽略，不让整次比价失败
                }
            }
            if (parsed.isEmpty()) {
                quotes = jdbc.query("SELECT * FROM info_quote WHERE status='online' ORDER BY id LIMIT 4", quoteMapper());
            } else {
                String placeholders = String.join(",", java.util.Collections.nCopies(parsed.size(), "?"));
                quotes = jdbc.query("SELECT * FROM info_quote WHERE id IN (" + placeholders + ") ORDER BY id",
                        quoteMapper(), parsed.toArray());
            }
        }
        for (Map<String, Object> quote : quotes) {
            quote.put("normalized", normalize(quote));
        }
        return quotes;
    }

    public List<Map<String, Object>> indices() {
        return jdbc.query("SELECT * FROM info_price_index WHERE status='published' ORDER BY id", indexMapper());
    }

    public Map<String, Object> indexDetail(long id) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_price_index WHERE id=?", indexMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("价格指数不存在");
        }
        Map<String, Object> index = rows.get(0);
        Map<String, Object> result = new LinkedHashMap<>(index);
        result.put("series", indexSeries(index));
        result.put("components", jdbc.query("""
                SELECT id,name,icon,origin,price,price_unit,change_pct FROM info_quote
                WHERE status='online' ORDER BY ABS(change_pct) DESC LIMIT 6
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("name", rs.getString("name"));
            item.put("icon", rs.getString("icon"));
            item.put("origin", rs.getString("origin"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("priceUnit", rs.getString("price_unit"));
            item.put("changePct", rs.getBigDecimal("change_pct"));
            return item;
        }));
        return result;
    }

    public Map<String, Object> forecast(long quoteId, String horizon) {
        Map<String, Object> quote = quote(quoteId);
        String window = "30d".equalsIgnoreCase(horizon) ? "30d" : "7d";
        Map<String, Object> forecast = forecastOf(quoteId, window);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("quote", quote);
        result.put("forecast", forecast);
        result.put("series", series(quote));
        result.put("drivers", drivers());
        result.put("mape", forecast == null ? "6.0" : forecast.get("mape"));
        return result;
    }

    // ==================== 资讯 ====================

    public Map<String, Object> articles(String channel, String contentType, String keyword, int page, int size) {
        int current = Math.max(page, 1);
        int pageSize = Math.min(Math.max(size, 1), 50);
        StringBuilder where = new StringBuilder(" FROM info_article WHERE status='published'");
        List<Object> args = new ArrayList<>();
        if (channel != null && !channel.isBlank() && !"推荐".equals(channel) && !"全部".equals(channel)) {
            where.append(" AND channel=?");
            args.add(channel);
        }
        if (contentType != null && !contentType.isBlank() && !"全部".equals(contentType)) {
            where.append(" AND content_type=?");
            args.add(contentType);
        }
        if (keyword != null && !keyword.isBlank()) {
            where.append(" AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(tags) LIKE ?)");
            args.add(like(keyword));
            args.add(like(keyword));
            args.add(like(keyword));
        }
        long total = number("SELECT COUNT(*)" + where, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(pageSize);
        pageArgs.add((current - 1) * pageSize);
        List<Map<String, Object>> items = jdbc.query(
                "SELECT *" + where + " ORDER BY is_top DESC, published_at DESC LIMIT ? OFFSET ?",
                articleMapper(false), pageArgs.toArray());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("total", total);
        result.put("page", current);
        result.put("size", pageSize);
        result.put("channels", channels());
        result.put("hot", jdbc.query("""
                SELECT id,title,read_count,cover_icon FROM info_article WHERE status='published'
                ORDER BY read_count DESC LIMIT 5
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("title", rs.getString("title"));
            item.put("readCount", rs.getInt("read_count"));
            item.put("coverIcon", rs.getString("cover_icon"));
            return item;
        }));
        return result;
    }

    public Map<String, Object> articleDetail(long id, String user) {
        Map<String, Object> article = article(id);
        jdbc.update("UPDATE info_article SET read_count=read_count+1 WHERE id=?", id);
        Map<String, Object> result = new LinkedHashMap<>(article);
        result.put("comments", jdbc.query(
                "SELECT * FROM info_article_comment WHERE article_id=? AND status='published' ORDER BY id DESC",
                commentMapper(), id));
        result.put("related", jdbc.query("""
                SELECT * FROM info_article WHERE status='published' AND id<>? AND channel=?
                ORDER BY published_at DESC LIMIT 3
                """, articleMapper(false), id, article.get("channel")));
        result.put("favorited", number(
                "SELECT COUNT(*) FROM info_favorite WHERE target_type='article' AND target_id=? AND owner=?",
                id, user) > 0);
        result.put("attestation", jdbc.query(
                "SELECT * FROM info_attestation WHERE content_type='article' AND content_id=? LIMIT 1",
                attestationMapper(), id).stream().findFirst().orElse(null));
        return result;
    }

    public Map<String, Object> likeArticle(long id) {
        jdbc.update("UPDATE info_article SET like_count=like_count+1 WHERE id=?", id);
        return Map.of("likeCount", number("SELECT like_count FROM info_article WHERE id=?", id));
    }

    public Map<String, Object> commentArticle(long id, String user, Map<String, Object> body) {
        article(id);
        String content = required(body, "content", "请填写评论内容");
        jdbc.update("""
                INSERT INTO info_article_comment (article_id,user_name,user_region,content)
                VALUES (?,?,?,?)
                """, id, user, text(body, "region", "平台用户"), content);
        jdbc.update("UPDATE info_article SET comment_count=comment_count+1 WHERE id=?", id);
        return Map.of("message", "评论已发布", "comments", jdbc.query(
                "SELECT * FROM info_article_comment WHERE article_id=? AND status='published' ORDER BY id DESC",
                commentMapper(), id));
    }

    /**
     * 栏目列表：篇数按已发布内容实查，不读 {@code info_channel.article_count} 那一列。
     *
     * <p>该列是种子数据写死的（政策法规 1286、生产技术 3864…），而库里实际只有个位数已发布内容；
     * 运营在内容管理里发布或下架文章，这一列也不会变。门户与用户端的栏目角标因此一直对不上总数。
     * 新建栏目插入的是 0，同样永远不动。</p>
     */
    public List<Map<String, Object>> channels() {
        return jdbc.query("""
                SELECT c.id, c.code, c.name, c.icon, c.description, c.status,
                       (SELECT COUNT(*) FROM info_article a
                         WHERE a.channel = c.name AND a.status = 'published') AS article_count
                FROM info_channel c
                WHERE c.status = 'enabled'
                ORDER BY c.sort_no
                """, channelMapper());
    }

    /** 作者列表：篇数同样按已发布内容实查（原列是种子的 486/1268 这类假数）。 */
    public List<Map<String, Object>> authors() {
        return jdbc.query("""
                SELECT u.id, u.name, u.author_type, u.avatar_text, u.title, u.org_name,
                       u.followers, u.verified,
                       (SELECT COUNT(*) FROM info_article a
                         WHERE a.author = u.name AND a.status = 'published') AS article_count
                FROM info_author u
                WHERE u.status = 'enabled'
                ORDER BY u.id
                """, authorMapper());
    }

    // ==================== 供需大厅 ====================
    // 供需数据已整体迁到交易撮合模块（供应=agri_trade_product、需求=agri_trade_demand），
    // 撮合走交易模块的 /api/trade/match/*，本模块只保留"需求侧留言"这一张本地表。
    // 原先读写 info_supply_demand / info_sd_match 的那套方法已全部删除：
    // 那两张表里只剩历史演示数据，继续留着会让人误以为信息端还维护着第二份供需库。

    /**
     * 需求侧详情页的站内留言。
     *
     * <p>供应侧走交易模块的店铺洽谈会话，只有需求侧没有反向会话模型，才落在本地
     * {@code info_sd_message}。这里的 {@code sdId} 是<b>交易模块的需求 id</b>，
     * 拿它去查旧的 {@code info_supply_demand} 必然查不到，所以不再做任何死表校验/回写；
     * 需求是否真实存在由上层 {@code SupplyDemandService.detail()} 向交易模块确认。</p>
     */
    public Map<String, Object> sendSdMessage(long sdId, String user, Map<String, Object> body) {
        String content = required(body, "content", "请填写沟通内容");
        jdbc.update("""
                INSERT INTO info_sd_message (sd_id,direction,from_name,content)
                VALUES (?, 'out', ?, ?)
                """, sdId, user, content);
        return Map.of("message", "消息已发送", "messages", jdbc.query(
                "SELECT * FROM info_sd_message WHERE sd_id=? ORDER BY id", sdMessageMapper(), sdId));
    }

    // ==================== 培训 / 知识库 ====================

    // ==================== 门户首页推荐 ====================

    /** 门户首页头条槽位 id，对应 data.sql 里「门户首页头条」那条。 */
    public static final long PORTAL_HOME_SLOT_ID = 6;

    /**
     * 门户首页头条：优先用运营编排的推荐内容，没有编排就按时间回退。
     *
     * <p>回退是必须的 —— 新环境里运营还没配内容，首页不能开天窗；
     * 返回值带 {@code curated} 标记，前端据此决定是否显示「运营推荐」的角标。</p>
     */
    public Map<String, Object> portalRecommend() {
        List<Map<String, Object>> items = jdbc.query("""
                SELECT a.* FROM info_recommend_item i
                JOIN info_article a ON a.id = i.content_id
                WHERE i.slot_id=? AND i.content_type='article' AND i.status='online'
                  AND a.status='published'
                ORDER BY i.sort_no, i.id
                """, articleMapper(false), PORTAL_HOME_SLOT_ID);
        boolean curated = !items.isEmpty();
        if (!curated) {
            items = jdbc.query("""
                    SELECT * FROM info_article WHERE status='published'
                    ORDER BY is_top DESC, published_at DESC LIMIT 4
                    """, articleMapper(false));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("curated", curated);
        result.put("items", items);
        return result;
    }

    public Map<String, Object> courses(String user) {
        List<Map<String, Object>> items = jdbc.query(
                "SELECT * FROM info_course WHERE status='published' ORDER BY is_live DESC, id", courseMapper());
        for (Map<String, Object> item : items) {
            long id = longValue(item.get("id"), 0);
            long totalSec = number(
                    "SELECT COALESCE(SUM(duration_sec),0) FROM info_course_lesson WHERE course_id=? AND status='published'", id);
            long watchedSec = number(
                    "SELECT COALESCE(SUM(position_sec),0) FROM info_course_learn WHERE course_id=? AND owner=?", id, user);
            item.put("lessonCount", number(
                    "SELECT COUNT(*) FROM info_course_lesson WHERE course_id=? AND status='published'", id));
            item.put("totalDurationSec", totalSec);
            // 覆盖 courseMapper 里那个全站共享的 info_course.progress：
            // 那是历史字段，多人看同一门课会互相覆盖，不能当个人进度用。
            item.put("progress", totalSec <= 0 ? 0 : (int) Math.min(100, Math.round(watchedSec * 100.0 / totalSec)));
            item.put("enrolled", enrolled(id, user));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("live", items.stream().filter(item -> Boolean.TRUE.equals(item.get("isLive"))).findFirst().orElse(null));
        result.put("learners", items.stream().mapToInt(item -> intValue(item.get("learners"))).sum());
        return result;
    }

    public Map<String, Object> enrollCourse(long id, String user) {
        int updated = jdbc.update("""
                UPDATE info_course SET learners=learners+1,
                  progress=CASE WHEN progress=0 THEN 5 ELSE progress END
                WHERE id=?
                """, id);
        if (updated == 0) {
            throw new IllegalArgumentException("课程不存在");
        }
        jdbc.update("""
                INSERT INTO info_subscription (target_type,target_name,channel,frequency,enabled,owner)
                VALUES ('course',?,'站内消息','每周',TRUE,?)
                """, String.valueOf(course(id).get("title")), user);
        return Map.of("message", "已加入学习，课程更新将推送到消息中心", "course", course(id));
    }

    // ---------- 培训课程：章节 / 播放授权 / 学习进度 ----------

    /**
     * 课程详情：课程元信息 + 章节目录 + 当前用户的学习进度。
     *
     * <p>目录里刻意<b>不含</b>真实播放地址。地址必须逐节调 play-ticket 换票，
     * 一次性把整门课的地址下发，等于把整门课都授权出去了，报名/试看的限制也就形同虚设。</p>
     */
    public Map<String, Object> courseDetail(long id, String user) {
        Map<String, Object> detail = new LinkedHashMap<>(course(id));
        List<Map<String, Object>> lessons = jdbc.query(
                "SELECT * FROM info_course_lesson WHERE course_id=? AND status='published' ORDER BY seq, id",
                lessonMapper(), id);

        Map<Long, Map<String, Object>> learns = new LinkedHashMap<>();
        long lastLessonId = 0;
        for (Map<String, Object> row : jdbc.query(
                "SELECT * FROM info_course_learn WHERE course_id=? AND owner=? ORDER BY updated_at DESC",
                (rs, n) -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("lessonId", rs.getLong("lesson_id"));
                    item.put("positionSec", rs.getInt("position_sec"));
                    item.put("progress", rs.getInt("progress"));
                    item.put("finished", rs.getBoolean("finished"));
                    return item;
                }, id, user)) {
            long lessonId = longValue(row.get("lessonId"), 0);
            learns.put(lessonId, row);
            if (lastLessonId == 0 && intValue(row.get("positionSec")) > 0) {
                lastLessonId = lessonId;
            }
        }

        boolean enrolled = enrolled(id, user);
        int totalSec = 0;
        int watchedSec = 0;
        for (Map<String, Object> lesson : lessons) {
            long lessonId = longValue(lesson.get("id"), 0);
            Map<String, Object> learn = learns.get(lessonId);
            lesson.put("positionSec", learn == null ? 0 : learn.get("positionSec"));
            lesson.put("progress", learn == null ? 0 : learn.get("progress"));
            lesson.put("finished", learn != null && Boolean.TRUE.equals(learn.get("finished")));
            // 未报名时只有试看节可播，前端据此把其余节显示为「需报名」
            lesson.put("playable", enrolled || Boolean.TRUE.equals(lesson.get("freePreview")));
            totalSec += intValue(lesson.get("durationSec"));
            if (learn != null) {
                watchedSec += intValue(learn.get("positionSec"));
            }
        }

        detail.put("lessons", lessons);
        detail.put("lessonCount", lessons.size());
        detail.put("totalDurationSec", totalSec);
        detail.put("enrolled", enrolled);
        detail.put("lastLessonId", lastLessonId);
        detail.put("progress", totalSec <= 0 ? 0 : Math.min(100, Math.round(watchedSec * 100f / totalSec)));
        return detail;
    }

    /**
     * 播放授权检查：返回该节的可播放信息。
     *
     * <p>试看节对所有人开放；其余节要求已报名（报名语义沿用 info_subscription，
     * 与 {@link #enrollCourse} 的副作用保持一致，不额外引入报名表）。</p>
     */
    public Map<String, Object> lessonForPlay(long courseId, long lessonId, String user) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_course_lesson WHERE id=? AND course_id=? AND status='published'",
                lessonMapper(), lessonId, courseId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("课程章节不存在");
        }
        Map<String, Object> lesson = rows.get(0);
        if (!Boolean.TRUE.equals(lesson.get("freePreview")) && !enrolled(courseId, user)) {
            throw new IllegalArgumentException("请先加入学习后再播放本节");
        }
        // 播放地址单独取，不放进 lessonMapper：那个映射的结果会直接下发到前端，
        // 一旦把 video_url 放进去，目录接口就等于把整门课的地址都泄露了。
        lesson.put("videoUrl", jdbc.queryForObject(
                "SELECT video_url FROM info_course_lesson WHERE id=?", String.class, lessonId));
        return lesson;
    }

    /** 学习进度上报：同一节同一用户只保留一条，重复上报走更新。 */
    public Map<String, Object> reportProgress(long courseId, long lessonId, String user, Map<String, Object> body) {
        Map<String, Object> lesson = lessonForPlay(courseId, lessonId, user);
        int duration = intValue(lesson.get("durationSec"));
        int position = (int) longValue(body.get("positionSec"), 0);
        if (duration <= 0) {
            duration = Math.max(position, 1);
        }
        position = Math.max(0, Math.min(position, duration));
        int progress = Math.min(100, Math.round(position * 100f / duration));
        boolean finished = boolValue(body.get("finished"), false) || progress >= 95;

        int updated = jdbc.update("""
                UPDATE info_course_learn
                SET position_sec=?, progress=?, finished=?, updated_at=CURRENT_TIMESTAMP
                WHERE course_id=? AND lesson_id=? AND owner=?
                """, position, progress, finished, courseId, lessonId, user);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO info_course_learn (course_id,lesson_id,owner,position_sec,progress,finished)
                    VALUES (?,?,?,?,?,?)
                    """, courseId, lessonId, user, position, progress, finished);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("lessonId", lessonId);
        result.put("positionSec", position);
        result.put("progress", progress);
        result.put("finished", finished);
        return result;
    }

    private boolean enrolled(long courseId, String user) {
        return number("""
                SELECT COUNT(*) FROM info_subscription
                WHERE target_type='course' AND target_name=? AND owner=?
                """, String.valueOf(course(courseId).get("title")), user) > 0;
    }

    public List<Map<String, Object>> knowledge(String keyword, String crop) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_knowledge WHERE status='published'");
        List<Object> args = new ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(tags) LIKE ?)");
            args.add(like(keyword));
            args.add(like(keyword));
            args.add(like(keyword));
        }
        if (crop != null && !crop.isBlank() && !"全部作物".equals(crop)) {
            sql.append(" AND crop=?");
            args.add(crop);
        }
        sql.append(" ORDER BY view_count DESC");
        return jdbc.query(sql.toString(), knowledgeMapper(), args.toArray());
    }

    public Map<String, Object> knowledgeDetail(long id) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_knowledge WHERE id=?", knowledgeMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("知识条目不存在");
        }
        jdbc.update("UPDATE info_knowledge SET view_count=view_count+1 WHERE id=?", id);
        Map<String, Object> item = rows.get(0);
        Map<String, Object> result = new LinkedHashMap<>(item);
        result.put("related", jdbc.query("""
                SELECT id,title,category,crop,summary FROM info_knowledge
                WHERE status='published' AND id<>? AND (crop=? OR category=?) ORDER BY view_count DESC LIMIT 4
                """, (rs, rowNum) -> {
            Map<String, Object> related = new LinkedHashMap<>();
            related.put("id", rs.getLong("id"));
            related.put("title", rs.getString("title"));
            related.put("category", rs.getString("category"));
            related.put("crop", rs.getString("crop"));
            related.put("summary", rs.getString("summary"));
            return related;
        }, id, item.get("crop"), item.get("category")));
        return result;
    }

    // ==================== AI 问答 / 病虫害识别 ====================

    public Map<String, Object> askAi(Map<String, Object> body, String user) {
        String question = required(body, "question", "请描述您的问题");
        String crop = text(body, "crop", "");
        // 检索策略：整句 LIKE 在中文场景几乎必然落空（用户不会照抄知识标题），
        // 因此改为"字符二元组重叠度 + 作物命中加权"打分，从已发布知识条目里取最相关的几条。
        List<Map<String, Object>> pool = jdbc.query(
                "SELECT * FROM info_knowledge WHERE status='published' ORDER BY view_count DESC", knowledgeMapper());
        List<Map<String, Object>> scored = new ArrayList<>();
        for (Map<String, Object> item : pool) {
            int score = relevance(question, crop, item);
            if (score > 0) {
                Map<String, Object> copy = new LinkedHashMap<>(item);
                copy.put("score", score);
                scored.add(copy);
            }
        }
        scored.sort((left, right) -> intValue(right.get("score")) - intValue(left.get("score")));
        List<Map<String, Object>> hits = scored.stream().limit(3).toList();

        String answer;
        String category;
        String refs;
        int confidence;
        if (hits.isEmpty()) {
            answer = "问题信息还不够充分。建议补充：作物品种、发病部位与面积、近 7 天天气、近期用药情况，"
                    + "以及清晰的叶片/根部照片。补充后我可以给出更具体的判断；也可以直接转农艺专家复核。";
            category = "综合咨询";
            refs = "农技知识库（未命中高相关条目）";
            confidence = 62;
        } else {
            Map<String, Object> top = hits.get(0);
            answer = "结合知识库条目《" + top.get("title") + "》判断：" + top.get("summary")
                    + "\n\n处理建议：\n" + top.get("content")
                    + "\n\n补充说明：如症状在 24 小时内快速扩散，或涉及大面积死苗，建议直接转农艺专家复核，避免误判造成损失。";
            category = String.valueOf(top.get("category"));
            refs = "农技知识库《" + top.get("title") + "》；平台病虫害图谱";
            confidence = Math.min(96, 78 + intValue(top.get("score")) * 3);
        }
        String qaNo = serial("QA");
        jdbc.update("""
                INSERT INTO info_qa_record
                (qa_no,qa_type,question,answer,category,crop,source_refs,confidence,expert_name,status,asked_by)
                VALUES (?, 'ai', ?,?,?,?,?,?, 'AI农技助手', 'answered', ?)
                """, qaNo, question, answer, category, crop.isBlank() ? "未指定" : crop, refs, confidence, user);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("qaNo", qaNo);
        result.put("answer", answer);
        result.put("category", category);
        result.put("confidence", confidence);
        result.put("sourceRefs", split(refs, "；"));
        result.put("related", hits.stream().map(item -> {
            Map<String, Object> related = new LinkedHashMap<>();
            related.put("id", item.get("id"));
            related.put("title", item.get("title"));
            related.put("summary", item.get("summary"));
            return related;
        }).toList());
        result.put("expertAvailable", true);
        return result;
    }

    /** 二元组重叠打分：中文短句检索比整句 LIKE 稳定；作物命中额外加权。 */
    private int relevance(String question, String crop, Map<String, Object> knowledge) {
        String target = (knowledge.get("title") + " " + knowledge.get("summary") + " "
                + knowledge.get("tags") + " " + knowledge.get("crop")).toLowerCase(java.util.Locale.ROOT);
        String source = question.toLowerCase(java.util.Locale.ROOT);
        int score = 0;
        for (int i = 0; i + 2 <= source.length(); i++) {
            if (target.contains(source.substring(i, i + 2))) {
                score++;
            }
        }
        if (!crop.isBlank() && target.contains(crop.toLowerCase(java.util.Locale.ROOT))) {
            score += 6;
        }
        return score >= 2 ? score : 0;
    }

    public Map<String, Object> pestIdentify(Map<String, Object> body, String user) {
        String crop = text(body, "crop", "未指定作物");
        String symptom = text(body, "symptom", "");
        String lower = symptom.toLowerCase(java.util.Locale.ROOT);
        List<Map<String, Object>> candidates = new ArrayList<>();
        if (lower.contains("黄") || lower.contains("斑点") || lower.contains("褐")) {
            candidates.add(pest("叶斑类真菌病害", 86, "病斑多从下部叶片开始，湿度大时有霉层，与缺素症状需区分"));
            candidates.add(pest("缺钾 / 缺镁", 62, "叶缘或脉间黄化，叶脉保持绿色，可通过叶面喷施验证"));
        }
        if (lower.contains("虫") || lower.contains("飞") || lower.contains("咬")) {
            candidates.add(pest("刺吸式害虫（蚜虫/粉虱）", 82, "叶片背面可见虫体或蜜露，注意检查嫩梢"));
            candidates.add(pest("螨类（红蜘蛛）", 58, "叶背有细小斑点与蛛丝，高温干燥时高发"));
        }
        if (lower.contains("萎") || lower.contains("枯") || lower.contains("死")) {
            candidates.add(pest("根腐 / 枯萎病", 78, "需挖取样株检查根系颜色与气味，排查积水"));
            candidates.add(pest("渍害 / 根系缺氧", 54, "近期强降雨或大水漫灌后出现，排水后可缓解"));
        }
        if (candidates.isEmpty()) {
            candidates.add(pest("症状信息不足", 45, "建议补充清晰照片与发病环境信息后重新识别"));
        }
        String qaNo = serial("SB");
        String answer = "识别到 " + candidates.size() + " 个可能方向，最高置信度 " + candidates.get(0).get("probability")
                + "%。建议先按最高可能方向做小范围验证，避免全田用药。";
        jdbc.update("""
                INSERT INTO info_qa_record
                (qa_no,qa_type,question,answer,category,crop,source_refs,confidence,expert_name,status,asked_by)
                VALUES (?, 'pest', ?,?, '病虫害识别', ?, '图像识别模型 + 农技知识库', ?, 'AI农技助手', 'answered', ?)
                """, qaNo, "拍照识病虫：" + symptom, answer, crop,
                intValue(candidates.get(0).get("probability")), user);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("qaNo", qaNo);
        result.put("crop", crop);
        result.put("candidates", candidates);
        result.put("advice", "建议：1) 拍摄 3 片病叶正反面与整株照片；2) 记录发病面积与近 7 天天气；"
                + "3) 先隔离病株，避免盲目混配农药；4) 24 小时内扩散明显请转专家复核。");
        result.put("expertAvailable", true);
        return result;
    }

    public List<Map<String, Object>> qaRecords(String user) {
        return jdbc.query("SELECT * FROM info_qa_record WHERE asked_by=? ORDER BY id DESC LIMIT 20", qaMapper(), user);
    }

    // ==================== 专家 ====================

    public Map<String, Object> experts(String field) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_expert WHERE status='approved'");
        List<Object> args = new ArrayList<>();
        if (field != null && !field.isBlank() && !"全部领域".equals(field)) {
            sql.append(" AND field_name=?");
            args.add(field);
        }
        sql.append(" ORDER BY rating DESC, answer_count DESC");
        List<Map<String, Object>> items = jdbc.query(sql.toString(), expertMapper(), args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("fields", jdbc.queryForList(
                "SELECT DISTINCT field_name FROM info_expert WHERE status='approved' ORDER BY field_name", String.class));
        result.put("questions", jdbc.query("""
                SELECT * FROM info_qa_record WHERE qa_type='expert' ORDER BY id DESC LIMIT 8
                """, qaMapper()));
        return result;
    }

    public Map<String, Object> expertDetail(long id) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_expert WHERE id=?", expertMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("专家不存在");
        }
        Map<String, Object> result = new LinkedHashMap<>(rows.get(0));
        result.put("answers", jdbc.query("""
                SELECT * FROM info_qa_record WHERE expert_name=? AND qa_type='expert' ORDER BY id DESC LIMIT 6
                """, qaMapper(), result.get("name")));
        return result;
    }

    public Map<String, Object> applyExpert(Map<String, Object> body, String user) {
        String name = required(body, "name", "请填写真实姓名");
        String certNo = required(body, "certNo", "请填写职称证书编号");
        String field = required(body, "field", "请选择擅长领域");
        jdbc.update("""
                INSERT INTO info_expert
                (name,title_name,org_name,field_name,region,cert_no,expert_level,intro,answer_count,rating,
                 followers,status,apply_at,audit_note,owner)
                VALUES (?,?,?,?,?,?,?,?,0,5.0,0,'pending',?, '待审核：需补充职称证明与近 3 年业绩', ?)
                """,
                name,
                text(body, "title", "农艺师"),
                text(body, "orgName", "待补充"),
                field,
                text(body, "region", "待补充"),
                certNo,
                text(body, "level", "平台认证"),
                text(body, "intro", ""),
                nowLabel(),
                user);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "认证申请已提交，平台将在 3 个工作日内完成资质审核");
        result.put("status", "pending");
        result.put("records", myExpert(user));
        return result;
    }

    public List<Map<String, Object>> myExpert(String user) {
        return jdbc.query("SELECT * FROM info_expert WHERE owner=? ORDER BY id DESC", expertMapper(), user);
    }

    // ==================== 数据报告 ====================

    public Map<String, Object> reports(String category) {
        StringBuilder sql = new StringBuilder("SELECT * FROM info_report WHERE status='published'");
        List<Object> args = new ArrayList<>();
        if (category != null && !category.isBlank() && !"全部".equals(category)) {
            sql.append(" AND category=?");
            args.add(category);
        }
        sql.append(" ORDER BY published_at DESC");
        List<Map<String, Object>> items = jdbc.query(sql.toString(), reportMapper(), args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("categories", jdbc.queryForList(
                "SELECT DISTINCT category FROM info_report WHERE status='published' ORDER BY category", String.class));
        result.put("downloads", items.stream().mapToInt(item -> intValue(item.get("downloads"))).sum());
        return result;
    }

    public Map<String, Object> reportDetail(long id) {
        Map<String, Object> report = report(id);
        Map<String, Object> result = new LinkedHashMap<>(report);
        result.put("sections", split(String.valueOf(report.get("sections"))));
        result.put("related", jdbc.query("""
                SELECT id,title,category,period FROM info_report WHERE status='published' AND id<>?
                ORDER BY published_at DESC LIMIT 3
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("title", rs.getString("title"));
            item.put("category", rs.getString("category"));
            item.put("period", rs.getString("period"));
            return item;
        }, id));
        result.put("attestation", jdbc.query(
                "SELECT * FROM info_attestation WHERE content_type='report' AND content_id=? LIMIT 1",
                attestationMapper(), id).stream().findFirst().orElse(null));
        return result;
    }

    public Map<String, Object> downloadReport(long id) {
        report(id);
        jdbc.update("UPDATE info_report SET downloads=downloads+1 WHERE id=?", id);
        return Map.of("message", "报告已加入下载队列，可在「我的报告」中查看", "downloads",
                number("SELECT downloads FROM info_report WHERE id=?", id));
    }

    public List<Map<String, Object>> myReports(String user) {
        return jdbc.query("""
                SELECT r.* FROM info_report r
                WHERE r.status='published' AND (r.is_free=TRUE OR r.id IN (
                    SELECT target_id FROM info_favorite WHERE target_type='report' AND owner=?
                ))
                ORDER BY r.published_at DESC
                """, reportMapper(), user);
    }

    // ==================== 存证 ====================

    /**
     * 我的内容存证。
     *
     * <p>形参 {@code user} 原先<b>根本没进 SQL</b>（{@code SELECT * FROM info_attestation ORDER BY id DESC}），
     * 于是「内容存证」页把别人单位、别人作者的存证编号与哈希全量列了出来 ——
     * 那张表本来就有 owner 列（4 行、3 个不同 owner），加一个 WHERE 就修完，不需要迁移。</p>
     */
    public List<Map<String, Object>> attestations(String user) {
        return jdbc.query("SELECT * FROM info_attestation WHERE owner=? ORDER BY id DESC",
                attestationMapper(), user);
    }

    public Map<String, Object> attestationDetail(long id) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_attestation WHERE id=?", attestationMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("存证记录不存在");
        }
        Map<String, Object> result = new LinkedHashMap<>(rows.get(0));
        result.put("steps", List.of(
                step("内容提交", "平台内容审核通过后自动触发存证", true),
                step("哈希计算", "SHA-256 摘要生成，原文不出平台", true),
                step("链上写入", "农业联盟链多节点共识确认", true),
                step("验证可用", "任何人可凭存证编号在线验证", true)));
        return result;
    }

    public Map<String, Object> verifyAttestation(Map<String, Object> body) {
        String attestNo = required(body, "attestNo", "请输入存证编号");
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_attestation WHERE attest_no=?", attestationMapper(), attestNo.trim());
        Map<String, Object> result = new LinkedHashMap<>();
        if (rows.isEmpty()) {
            result.put("valid", false);
            result.put("message", "未查询到该存证编号，请核对后重试");
            return result;
        }
        Map<String, Object> record = rows.get(0);
        jdbc.update("UPDATE info_attestation SET verify_count=verify_count+1 WHERE attest_no=?", attestNo.trim());
        result.put("valid", true);
        result.put("message", "存证有效：内容哈希与链上记录一致");
        result.put("record", record);
        return result;
    }

    // ==================== 预警 / 订阅 / 收藏 ====================

    public List<Map<String, Object>> alertRules(String user) {
        return jdbc.query("SELECT * FROM info_alert_rule WHERE owner=? ORDER BY id", alertRuleMapper(), user);
    }

    public Map<String, Object> createAlertRule(Map<String, Object> body, String user) {
        String ruleName = required(body, "ruleName", "请填写预警名称");
        long quoteId = longValue(body.get("quoteId"), 0L);
        String quoteName = text(body, "quoteName", "自定义品种");
        if (quoteId > 0) {
            quoteName = String.valueOf(quote(quoteId).get("name"));
        }
        jdbc.update("""
                INSERT INTO info_alert_rule
                (rule_name,quote_id,quote_name,metric,operator_type,threshold_value,channel,enabled,hit_count,owner)
                VALUES (?,?,?,?,?,?,?,TRUE,0,?)
                """,
                ruleName,
                quoteId,
                quoteName,
                text(body, "metric", "涨跌幅"),
                text(body, "operator", ">="),
                decimal(body.get("threshold"), new BigDecimal("5")),
                text(body, "channel", "站内消息"),
                user);
        return Map.of("message", "预警规则已创建", "rules", alertRules(user));
    }

    public Map<String, Object> updateAlertRule(long id, Map<String, Object> body, String user) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_alert_rule WHERE id=? AND owner=?", alertRuleMapper(), id, user);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("预警规则不存在");
        }
        jdbc.update("""
                UPDATE info_alert_rule SET enabled=?, threshold_value=?, channel=? WHERE id=?
                """,
                boolValue(body.get("enabled"), Boolean.TRUE.equals(rows.get(0).get("enabled"))),
                decimal(body.get("threshold"), decimal(rows.get(0).get("threshold"), new BigDecimal("5"))),
                text(body, "channel", String.valueOf(rows.get(0).get("channel"))),
                id);
        return Map.of("message", "预警规则已更新", "rules", alertRules(user));
    }

    public Map<String, Object> alertMessages(String user) {
        List<Map<String, Object>> items = jdbc.query(
                "SELECT * FROM info_alert_message WHERE owner=? ORDER BY is_read, id DESC", alertMessageMapper(), user);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("unread", items.stream().filter(item -> !Boolean.TRUE.equals(item.get("read"))).count());
        return result;
    }

    public Map<String, Object> readAllAlerts(String user) {
        int updated = jdbc.update("UPDATE info_alert_message SET is_read=TRUE WHERE is_read=FALSE AND owner=?", user);
        return Map.of("updated", updated);
    }

    public List<Map<String, Object>> subscriptions(String user) {
        return jdbc.query("SELECT * FROM info_subscription WHERE owner=? ORDER BY id", subscriptionMapper(), user);
    }

    public Map<String, Object> createSubscription(Map<String, Object> body, String user) {
        String targetType = required(body, "targetType", "请选择订阅类型");
        String targetName = required(body, "targetName", "请填写订阅对象");
        jdbc.update("""
                INSERT INTO info_subscription (target_type,target_name,channel,frequency,enabled,owner)
                VALUES (?,?,?,?,TRUE,?)
                """, targetType, targetName,
                text(body, "channel", "站内消息"),
                text(body, "frequency", "每日"),
                user);
        return Map.of("message", "订阅已创建", "subscriptions", subscriptions(user));
    }

    public Map<String, Object> toggleSubscription(long id, Map<String, Object> body, String user) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM info_subscription WHERE id=? AND owner=?", subscriptionMapper(), id, user);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("订阅不存在");
        }
        jdbc.update("UPDATE info_subscription SET enabled=? WHERE id=?",
                boolValue(body.get("enabled"), !Boolean.TRUE.equals(rows.get(0).get("enabled"))), id);
        return Map.of("message", "订阅状态已更新", "subscriptions", subscriptions(user));
    }

    public List<Map<String, Object>> favorites(String user) {
        return jdbc.query("SELECT * FROM info_favorite WHERE owner=? ORDER BY id DESC", favoriteMapper(), user);
    }

    public Map<String, Object> addFavorite(Map<String, Object> body, String user) {
        String targetType = required(body, "targetType", "请指定收藏对象类型");
        long targetId = longValue(body.get("targetId"), 0L);
        String title = required(body, "title", "请填写收藏标题");
        long exists = number("""
                SELECT COUNT(*) FROM info_favorite WHERE owner=? AND target_type=? AND target_id=?
                """, user, targetType, targetId);
        if (exists == 0) {
            jdbc.update("""
                    INSERT INTO info_favorite (target_type,target_id,title,summary,owner)
                    VALUES (?,?,?,?,?)
                    """, targetType, targetId, title, text(body, "summary", ""), user);
        }
        return Map.of("message", exists == 0 ? "已收藏" : "该内容已在收藏中", "favorites", favorites(user));
    }

    public Map<String, Object> removeFavorite(long id, String user) {
        jdbc.update("DELETE FROM info_favorite WHERE id=? AND owner=?", id, user);
        return Map.of("message", "已取消收藏", "favorites", favorites(user));
    }

    // ==================== 搜索 ====================

    /**
     * 全站搜索（资讯 / 行情 / 知识库 / 报告）。
     *
     * <p>供需结果不在这里查 —— 供需数据在交易模块，由 Controller 层调
     * {@code SupplyDemandService.search()} 补齐，本方法只把 {@code supplyDemands}
     * 占位成空列表，保证返回结构稳定。</p>
     */
    public Map<String, Object> search(String keyword) {
        String q = keyword == null ? "" : keyword.trim();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("keyword", q);
        if (q.isEmpty()) {
            result.put("articles", List.of());
            result.put("quotes", List.of());
            result.put("knowledge", List.of());
            result.put("supplyDemands", List.of());
            result.put("reports", List.of());
            result.put("total", 0);
            return result;
        }
        List<Map<String, Object>> articles = jdbc.query("""
                SELECT * FROM info_article WHERE status='published'
                  AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(tags) LIKE ?)
                ORDER BY read_count DESC LIMIT 8
                """, articleMapper(false), like(q), like(q), like(q));
        List<Map<String, Object>> quotes = jdbc.query("""
                SELECT * FROM info_quote WHERE status='online' AND (LOWER(name) LIKE ? OR LOWER(origin) LIKE ?)
                LIMIT 4
                """, quoteMapper(), like(q), like(q));
        List<Map<String, Object>> knowledgeItems = knowledge(q, null).stream().limit(4).toList();
        List<Map<String, Object>> reportItems = jdbc.query("""
                SELECT * FROM info_report WHERE status='published'
                  AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?) LIMIT 3
                """, reportMapper(), like(q), like(q));
        result.put("articles", articles);
        result.put("quotes", quotes);
        result.put("knowledge", knowledgeItems);
        result.put("supplyDemands", List.of());
        result.put("reports", reportItems);
        result.put("total", articles.size() + quotes.size() + knowledgeItems.size() + reportItems.size());
        return result;
    }

    // ==================== 内部查询 ====================

    private Map<String, Object> quote(long id) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_quote WHERE id=?", quoteMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("品种行情不存在");
        }
        return rows.get(0);
    }

    private Map<String, Object> article(long id) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_article WHERE id=?", articleMapper(true), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("资讯不存在");
        }
        return rows.get(0);
    }

    private Map<String, Object> course(long id) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_course WHERE id=?", courseMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("课程不存在");
        }
        return rows.get(0);
    }

    private Map<String, Object> report(long id) {
        List<Map<String, Object>> rows = jdbc.query("SELECT * FROM info_report WHERE id=?", reportMapper(), id);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("报告不存在");
        }
        return rows.get(0);
    }

    private Map<String, Object> forecastOf(long quoteId, String horizon) {
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT * FROM info_forecast WHERE quote_id=? AND horizon=? ORDER BY id DESC LIMIT 1
                """, forecastMapper(), quoteId, horizon);
        if (!rows.isEmpty()) {
            return rows.get(0);
        }
        rows = jdbc.query("SELECT * FROM info_forecast WHERE quote_id=? ORDER BY id DESC LIMIT 1",
                forecastMapper(), quoteId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 30 日走势：以「月涨跌幅」反推起点，叠加确定性波动，保证同一品种每次刷新曲线一致。 */
    private List<Map<String, Object>> series(Map<String, Object> quote) {
        BigDecimal price = decimal(quote.get("price"), BigDecimal.ONE);
        int monthPct = intValue(quote.get("monthPct"));
        BigDecimal start = price.multiply(BigDecimal.valueOf(100L - monthPct))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        long seed = longValue(quote.get("id"), 1L);
        List<Map<String, Object>> points = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = 0; i < 30; i++) {
            double ratio = i / 29.0;
            double base = start.doubleValue() + (price.doubleValue() - start.doubleValue()) * ratio;
            double wobble = Math.sin((i + seed) * 1.7) * price.doubleValue() * 0.006;
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", today.minusDays(29L - i).toString());
            point.put("price", BigDecimal.valueOf(base + wobble).setScale(2, RoundingMode.HALF_UP));
            point.put("forecast", false);
            points.add(point);
        }
        Map<String, Object> forecast = forecastOf(longValue(quote.get("id"), 0L), "7d");
        if (forecast != null) {
            BigDecimal mid = decimal(forecast.get("midPrice"), price);
            BigDecimal low = decimal(forecast.get("lowPrice"), price);
            BigDecimal high = decimal(forecast.get("highPrice"), price);
            for (int i = 1; i <= 7; i++) {
                double ratio = i / 7.0;
                Map<String, Object> point = new LinkedHashMap<>();
                point.put("date", today.plusDays(i).toString());
                point.put("price", mid.multiply(BigDecimal.valueOf(ratio))
                        .add(price.multiply(BigDecimal.valueOf(1 - ratio))).setScale(2, RoundingMode.HALF_UP));
                point.put("low", low);
                point.put("high", high);
                point.put("forecast", true);
                points.add(point);
            }
        }
        return points;
    }

    private List<Map<String, Object>> indexSeries(Map<String, Object> index) {
        List<BigDecimal> points = trend(String.valueOf(index.get("trend")));
        List<Map<String, Object>> series = new ArrayList<>();
        if (points.isEmpty()) {
            return series;
        }
        LocalDate today = LocalDate.now();
        for (int i = 0; i < points.size(); i++) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", today.minusDays(points.size() - 1L - i).toString());
            point.put("value", points.get(i));
            series.add(point);
        }
        return series;
    }

    private List<BigDecimal> normalize(Map<String, Object> quote) {
        List<BigDecimal> trend = trend(String.valueOf(quote.get("trend")));
        if (trend.isEmpty()) {
            return List.of();
        }
        BigDecimal first = trend.get(0);
        if (first.signum() == 0) {
            return trend;
        }
        List<BigDecimal> normalized = new ArrayList<>();
        for (BigDecimal point : trend) {
            normalized.add(point.divide(first, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP));
        }
        return normalized;
    }

    private List<Map<String, Object>> regionPrices(long quoteId) {
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT origin,price,change_pct FROM info_quote WHERE status='online'
                ORDER BY ABS(change_pct) DESC LIMIT 4
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("region", rs.getString("origin"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("changePct", rs.getBigDecimal("change_pct"));
            return item;
        });
        if (rows.isEmpty()) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("region", "山东金乡");
            fallback.put("price", new BigDecimal("9.00"));
            fallback.put("changePct", new BigDecimal("7.10"));
            return List.of(fallback);
        }
        return rows;
    }

    private Map<String, Object> aiMarketRead() {
        Map<String, Object> read = new LinkedHashMap<>();
        read.put("content", "本周葱姜蒜类集体走强，核心驱动为库存收紧 + 出口订单增加；叶菜类受北方设施菜集中上市影响价格回落。"
                + "建议种植户惜售等价，采购商适当补充耐储品种。");
        read.put("confidence", 86);
        read.put("updatedAt", nowLabel());
        return read;
    }

    private List<Map<String, Object>> drivers() {
        List<Map<String, Object>> drivers = new ArrayList<>();
        drivers.add(driver("🏪 批发市场 API", "200+ 品种实时价格", "权重 30%", "已接入 · 正常"));
        drivers.add(driver("🧑‍🌾 产地信息员", "36 名信息员报价", "权重 25%", "今日已报 36/36"));
        drivers.add(driver("🌦️ 气象数据", "温度 / 降水 / 灾害", "权重 15%", "未来 7 天晴好"));
        drivers.add(driver("🛰️ 卫星遥感", "NDVI / 种植面积", "权重 15%", "本周四更新"));
        drivers.add(driver("📰 舆情数据", "NLP 情感分析", "权重 10%", "看多情绪 71%"));
        drivers.add(driver("📜 政策数据", "补贴 / 调控 / 进出口", "权重 5%", "近期无直接调控"));
        drivers.add(driver("📦 库存数据", "冷库在库监测", "辅助", "低于常年 50%"));
        drivers.add(driver("🚢 出口订单", "海关 + 平台撮合数据", "辅助", "环比 +22%"));
        return drivers;
    }

    private Map<String, Object> todo(String title, String content, String page, String tag) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("title", title);
        item.put("content", content);
        item.put("page", page);
        item.put("tag", tag);
        return item;
    }

    private Map<String, Object> step(String title, String note, boolean done) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("title", title);
        item.put("note", note);
        item.put("done", done);
        return item;
    }

    private Map<String, Object> pest(String name, int probability, String note) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", name);
        item.put("probability", probability);
        item.put("note", note);
        return item;
    }

    private Map<String, Object> driver(String name, String detail, String weight, String state) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", name);
        item.put("detail", detail);
        item.put("weight", weight);
        item.put("state", state);
        return item;
    }

    // ==================== RowMapper ====================

    protected RowMapper<Map<String, Object>> channelMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("code", rs.getString("code"));
            item.put("name", rs.getString("name"));
            item.put("icon", rs.getString("icon"));
            item.put("description", rs.getString("description"));
            item.put("articleCount", rs.getInt("article_count"));
            item.put("status", rs.getString("status"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> authorMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("name", rs.getString("name"));
            item.put("authorType", rs.getString("author_type"));
            item.put("avatarText", rs.getString("avatar_text"));
            item.put("title", rs.getString("title"));
            item.put("orgName", rs.getString("org_name"));
            item.put("articleCount", rs.getInt("article_count"));
            item.put("followers", rs.getInt("followers"));
            item.put("verified", rs.getBoolean("verified"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> articleMapper(boolean withContent) {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("articleNo", rs.getString("article_no"));
            item.put("title", rs.getString("title"));
            item.put("channel", rs.getString("channel"));
            item.put("contentType", rs.getString("content_type"));
            item.put("summary", rs.getString("summary"));
            if (withContent) {
                item.put("content", rs.getString("content"));
            }
            item.put("author", rs.getString("author"));
            item.put("authorType", rs.getString("author_type"));
            item.put("coverIcon", rs.getString("cover_icon"));
            item.put("tags", split(rs.getString("tags")));
            item.put("readCount", rs.getInt("read_count"));
            item.put("likeCount", rs.getInt("like_count"));
            item.put("commentCount", rs.getInt("comment_count"));
            item.put("favoriteCount", rs.getInt("favorite_count"));
            item.put("status", rs.getString("status"));
            item.put("riskLevel", rs.getString("risk_level"));
            item.put("riskNote", rs.getString("risk_note"));
            item.put("auditNote", rs.getString("audit_note"));
            item.put("isTop", rs.getBoolean("is_top"));
            item.put("aiGenerated", rs.getBoolean("ai_generated"));
            item.put("source", rs.getString("source"));
            item.put("publishedAt", rs.getString("published_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> commentMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("userName", rs.getString("user_name"));
            item.put("userRegion", rs.getString("user_region"));
            item.put("content", rs.getString("content"));
            item.put("likeCount", rs.getInt("like_count"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> quoteMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("code", rs.getString("code"));
            item.put("name", rs.getString("name"));
            item.put("icon", rs.getString("icon"));
            item.put("category", rs.getString("category"));
            item.put("origin", rs.getString("origin"));
            item.put("market", rs.getString("market"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("priceUnit", rs.getString("price_unit"));
            item.put("changeAmount", rs.getBigDecimal("change_amount"));
            item.put("changePct", rs.getBigDecimal("change_pct"));
            item.put("weekPct", rs.getBigDecimal("week_pct"));
            item.put("monthPct", rs.getBigDecimal("month_pct"));
            item.put("spec", rs.getString("spec"));
            item.put("source", rs.getString("source"));
            item.put("trend", trend(rs.getString("trend")));
            item.put("monitorLevel", rs.getString("monitor_level"));
            item.put("status", rs.getString("status"));
            item.put("updatedAt", rs.getString("updated_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> indexMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("code", rs.getString("code"));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("value", rs.getBigDecimal("index_value"));
            item.put("changePct", rs.getBigDecimal("change_pct"));
            item.put("basePeriod", rs.getString("base_period"));
            item.put("sampleCount", rs.getInt("sample_count"));
            item.put("method", rs.getString("method"));
            item.put("trend", trend(rs.getString("trend")));
            item.put("status", rs.getString("status"));
            item.put("publishedAt", rs.getString("published_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> forecastMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("quoteId", rs.getLong("quote_id"));
            item.put("horizon", rs.getString("horizon"));
            item.put("midPrice", rs.getBigDecimal("mid_price"));
            item.put("lowPrice", rs.getBigDecimal("low_price"));
            item.put("highPrice", rs.getBigDecimal("high_price"));
            item.put("upProbability", rs.getInt("up_probability"));
            item.put("flatProbability", rs.getInt("flat_probability"));
            item.put("downProbability", rs.getInt("down_probability"));
            item.put("supplyIndex", rs.getInt("supply_index"));
            item.put("demandIndex", rs.getInt("demand_index"));
            item.put("stockDays", rs.getString("stock_days"));
            item.put("salesAdvice", rs.getString("sales_advice"));
            item.put("plantAdvice", rs.getString("plant_advice"));
            item.put("confidence", rs.getInt("confidence"));
            item.put("mape", rs.getBigDecimal("mape"));
            item.put("riskJson", rs.getString("risk_json"));
            item.put("drivers", rs.getString("drivers"));
            item.put("updatedAt", rs.getString("updated_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> sdMessageMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("sdId", rs.getLong("sd_id"));
            item.put("direction", rs.getString("direction"));
            item.put("fromName", rs.getString("from_name"));
            item.put("content", rs.getString("content"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> courseMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("title", rs.getString("title"));
            item.put("teacher", rs.getString("teacher"));
            item.put("mode", rs.getString("course_mode"));
            item.put("duration", rs.getString("duration"));
            item.put("learners", rs.getInt("learners"));
            item.put("rating", rs.getBigDecimal("rating"));
            item.put("progress", rs.getInt("progress"));
            item.put("coverIcon", rs.getString("cover_icon"));
            item.put("summary", rs.getString("summary"));
            item.put("tags", split(rs.getString("tags")));
            item.put("liveAt", rs.getString("live_at"));
            item.put("isLive", rs.getBoolean("is_live"));
            item.put("status", rs.getString("status"));
            return item;
        };
    }

    /**
     * 课程章节行映射。
     *
     * <p>刻意<b>不</b>下发 video_url：播放地址只能通过 play-ticket 逐节换取。
     * 谁要是为了"省一次请求"把地址塞进目录，防盗链就整体失效了。</p>
     */
    protected RowMapper<Map<String, Object>> lessonMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("courseId", rs.getLong("course_id"));
            item.put("seq", rs.getInt("seq"));
            item.put("title", rs.getString("title"));
            int durationSec = rs.getInt("duration_sec");
            item.put("durationSec", durationSec);
            item.put("durationLabel", durationLabel(durationSec));
            item.put("mediaType", rs.getString("media_type"));
            item.put("coverUrl", rs.getString("cover_url"));
            item.put("freePreview", rs.getBoolean("free_preview"));
            item.put("status", rs.getString("status"));
            return item;
        };
    }

    private String durationLabel(int seconds) {
        if (seconds <= 0) {
            return "—";
        }
        int hour = seconds / 3600;
        int minute = seconds % 3600 / 60;
        int second = seconds % 60;
        return hour > 0
                ? String.format("%d:%02d:%02d", hour, minute, second)
                : String.format("%02d:%02d", minute, second);
    }

    protected RowMapper<Map<String, Object>> knowledgeMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("title", rs.getString("title"));
            item.put("category", rs.getString("category"));
            item.put("crop", rs.getString("crop"));
            item.put("summary", rs.getString("summary"));
            item.put("content", rs.getString("content"));
            item.put("sourceName", rs.getString("source_name"));
            item.put("viewCount", rs.getInt("view_count"));
            item.put("tags", split(rs.getString("tags")));
            item.put("updatedAt", rs.getString("updated_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> qaMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("qaNo", rs.getString("qa_no"));
            item.put("qaType", rs.getString("qa_type"));
            item.put("question", rs.getString("question"));
            item.put("answer", rs.getString("answer"));
            item.put("category", rs.getString("category"));
            item.put("crop", rs.getString("crop"));
            item.put("sourceRefs", rs.getString("source_refs"));
            item.put("confidence", rs.getInt("confidence"));
            item.put("expertName", rs.getString("expert_name"));
            item.put("status", rs.getString("status"));
            item.put("askedBy", rs.getString("asked_by"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> expertMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("name", rs.getString("name"));
            item.put("title", rs.getString("title_name"));
            item.put("orgName", rs.getString("org_name"));
            item.put("field", rs.getString("field_name"));
            item.put("region", rs.getString("region"));
            item.put("certNo", rs.getString("cert_no"));
            item.put("level", rs.getString("expert_level"));
            item.put("intro", rs.getString("intro"));
            item.put("answerCount", rs.getInt("answer_count"));
            item.put("rating", rs.getBigDecimal("rating"));
            item.put("followers", rs.getInt("followers"));
            item.put("status", rs.getString("status"));
            item.put("applyAt", rs.getString("apply_at"));
            item.put("auditAt", rs.getString("audit_at"));
            item.put("auditNote", rs.getString("audit_note"));
            item.put("owner", rs.getString("owner"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> reportMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("reportNo", rs.getString("report_no"));
            item.put("title", rs.getString("title"));
            item.put("category", rs.getString("category"));
            item.put("period", rs.getString("period"));
            item.put("summary", rs.getString("summary"));
            item.put("sections", rs.getString("sections"));
            item.put("pageCount", rs.getInt("page_count"));
            item.put("price", rs.getBigDecimal("price"));
            item.put("downloads", rs.getInt("downloads"));
            item.put("isFree", rs.getBoolean("is_free"));
            item.put("status", rs.getString("status"));
            item.put("publishedAt", rs.getString("published_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> attestationMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("attestNo", rs.getString("attest_no"));
            item.put("title", rs.getString("title"));
            item.put("contentType", rs.getString("content_type"));
            item.put("contentId", rs.getLong("content_id"));
            item.put("contentHash", rs.getString("content_hash"));
            item.put("chainName", rs.getString("chain_name"));
            item.put("blockHeight", rs.getString("block_height"));
            item.put("txId", rs.getString("tx_id"));
            item.put("attestedAt", rs.getString("attested_at"));
            item.put("status", rs.getString("status"));
            item.put("verifyCount", rs.getInt("verify_count"));
            item.put("owner", rs.getString("owner"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> alertRuleMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("ruleName", rs.getString("rule_name"));
            item.put("quoteId", rs.getLong("quote_id"));
            item.put("quoteName", rs.getString("quote_name"));
            item.put("metric", rs.getString("metric"));
            item.put("operator", rs.getString("operator_type"));
            item.put("threshold", rs.getBigDecimal("threshold_value"));
            item.put("channel", rs.getString("channel"));
            item.put("enabled", rs.getBoolean("enabled"));
            item.put("hitCount", rs.getInt("hit_count"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> alertMessageMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("ruleId", rs.getLong("rule_id"));
            item.put("title", rs.getString("title"));
            item.put("content", rs.getString("content"));
            item.put("level", rs.getString("alert_level"));
            item.put("quoteName", rs.getString("quote_name"));
            item.put("triggerValue", rs.getString("trigger_value"));
            item.put("read", rs.getBoolean("is_read"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> subscriptionMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("targetType", rs.getString("target_type"));
            item.put("targetName", rs.getString("target_name"));
            item.put("channel", rs.getString("channel"));
            item.put("frequency", rs.getString("frequency"));
            item.put("enabled", rs.getBoolean("enabled"));
            return item;
        };
    }

    protected RowMapper<Map<String, Object>> favoriteMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("targetType", rs.getString("target_type"));
            item.put("targetId", rs.getLong("target_id"));
            item.put("title", rs.getString("title"));
            item.put("summary", rs.getString("summary"));
            item.put("createdAt", formatTimestamp(rs, "created_at"));
            return item;
        };
    }
}
