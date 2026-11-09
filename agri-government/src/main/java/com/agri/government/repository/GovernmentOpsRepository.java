package com.agri.government.repository;

import com.agri.common.exception.BusinessException;
import com.agri.government.integration.ProductionTraceClient;
import com.agri.government.security.GovernmentIdentityService;
import com.agri.government.security.GovernmentDataScope;
import com.agri.government.service.GovernmentAuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 监管运营端与移动执法端。
 *
 * <p>两条改动主线：</p>
 * <ol>
 *   <li><b>操作人由令牌解析</b>。原来 SQL 与日志里到处写死 '王磊'、'张科长'、'李敏'，
 *       谁登录都是王磊：任务分派、案件办理、复核结论都记在一个不存在的人身上，
 *       移动端"我的任务"其实永远是王磊的任务。</li>
 *   <li><b>动作要留下对方看得见的后果</b>。分派给谁就给谁发站内信；复核、结案、处理举报给主体发通知；
 *       现场取证真的落一条 {@code gov_evidence}（原来只往操作日志里塞一句话，再回一个临时哈希）。
 *       {@code gov_message} 在此之前没有任何写入方。</li>
 * </ol>
 */
@Repository
public class GovernmentOpsRepository {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter SERIAL_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final AtomicLong SERIAL = new AtomicLong();

    private final JdbcTemplate jdbc;
    private final GovernmentDataScope scope;
    private final GovernmentIdentityService identity;
    private final GovernmentAuditService audit;
    private final ProductionTraceClient traceSource;

    public GovernmentOpsRepository(JdbcTemplate jdbc, GovernmentIdentityService identity,
                                   GovernmentAuditService audit, ProductionTraceClient traceSource, GovernmentDataScope scope) {
        this.scope = scope;
        this.jdbc = jdbc;
        this.identity = identity;
        this.audit = audit;
        this.traceSource = traceSource;
    }

    public Map<String, Object> overview() { return scope.statistics(this::scopedOverview); }
    private Map<String, Object> scopedOverview() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("subjects", number("SELECT COUNT(*) FROM gov_subject"));
        metrics.put("pendingWarnings", number("SELECT COUNT(*) FROM gov_warning WHERE status<>'closed'"));
        metrics.put("openCases", number("SELECT COUNT(*) FROM gov_case WHERE status<>'closed'"));
        metrics.put("pendingTasks", number("SELECT COUNT(*) FROM gov_task WHERE status<>'completed'"));
        Long samplingTotal = jdbc.queryForObject(scope.sql("SELECT COUNT(*) FROM gov_sampling"), Long.class);
        Long samplingPassed = jdbc.queryForObject(scope.sql(
                "SELECT COUNT(*) FROM gov_sampling WHERE result_text='合格'"), Long.class);
        metrics.put("samplingPassRate", samplingTotal == null || samplingTotal == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(samplingPassed == null ? 0 : samplingPassed)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(samplingTotal), 1, java.math.RoundingMode.HALF_UP));
        // AI 参与过的记录数：智能预警 + 主体自查，两者都在库里，不再是常量 146
        long aiAssist = number("SELECT COUNT(*) FROM gov_warning WHERE ai_confidence IS NOT NULL")
                + number("SELECT COUNT(*) FROM gov_self_check");
        metrics.put("aiAssistCount", aiAssist);
        metrics.put("tradeAmount", null);
        metrics.put("scopeNotice", "仅统计有效授权辖区；全域交易额和历史趋势未按辖区采集，暂不展示");
        return Map.of(
                "metrics", metrics,
                "trend", jdbc.query(scope.sql("SELECT * FROM gov_daily_metric ORDER BY metric_date"), dailyMapper()),
                "todos", List.of(
                        todo("warnings", "预警处置", number("SELECT COUNT(*) FROM gov_warning WHERE status='pending'"), "红警与跨部门核查"),
                        todo("tasks", "执法任务", number("SELECT COUNT(*) FROM gov_task WHERE status='pending'"), "今日到期任务"),
                        todo("repairs", "信用修复", number("SELECT COUNT(*) FROM gov_credit_repair WHERE status IN ('submitted','reviewing')"), "AI 初审完成待复核"),
                        todo("subsidies", "补贴审核", number("SELECT COUNT(*) FROM gov_subsidy WHERE status NOT IN ('paid','rejected')"), "遥感核查与项目复核"),
                        todo("complaints", "举报处理", number("SELECT COUNT(*) FROM gov_complaint WHERE status<>'resolved'"), "12345 / 12315 转办"),
                        todo("rectifications", "整改复核", number("SELECT COUNT(*) FROM gov_rectification WHERE status='feedback'"), "主体已反馈待结案")
                ),
                "warnings", warnings(null),
                "aiBrief", aiBrief()
        );
    }

    /**
     * 值班简报：由真实预警与本主体指标生成，不再是三段写死的文案。
     *
     * <p>写死的简报最坏的地方在于它看起来永远"对"：即使预警都处置完了，它还在提醒同一件事。</p>
     */
    private List<String> aiBrief() {
        List<String> brief = new ArrayList<>();
        long redPending = number("SELECT COUNT(*) FROM gov_warning WHERE level_name='red' AND status<>'closed'");
        long orangePending = number("SELECT COUNT(*) FROM gov_warning WHERE level_name='orange' AND status<>'closed'");
        if (redPending + orangePending == 0) {
            brief.add("当前没有未办结的红/橙级预警，值班重点可放在在办案件与整改复核。");
        } else {
            brief.add("未办结红级预警 " + redPending + " 条、橙级 " + orangePending + " 条，请优先分派跨部门核查。");
        }
        long failedSampling = number("SELECT COUNT(*) FROM gov_sampling WHERE result_text='不合格'");
        long openCases = number("SELECT COUNT(*) FROM gov_case WHERE status<>'closed'");
        brief.add("抽检不合格 " + failedSampling + " 批次，在办案件 " + openCases + " 件；不合格批次应在 5 个工作日内立案或出具处置意见。");
        long feedbackPending = number("SELECT COUNT(*) FROM gov_rectification WHERE status='feedback'");
        long overdue = overdueRectifications();
        brief.add("主体已反馈待复核 " + feedbackPending + " 条" + (overdue > 0
                ? "，另有 " + overdue + " 条整改已逾期未反馈，需现场复查。" : "。"));
        long highRisk = number("SELECT COUNT(*) FROM gov_subject WHERE risk_level='high'");
        brief.add("高风险主体 " + highRisk + " 家，建议纳入分级分类监管的重点抽查名单。");
        return brief;
    }

    private long overdueRectifications() {
        long total = 0;
        String today = DATE.format(LocalDateTime.now());
        for (Object deadline : jdbc.queryForList(scope.sql(
                "SELECT deadline FROM gov_rectification WHERE status<>'closed' AND deadline IS NOT NULL"),
                String.class)) {
            if (deadline != null && String.valueOf(deadline).compareTo(today) < 0) {
                total++;
            }
        }
        return total;
    }

    public List<Map<String, Object>> subjects(String keyword, String riskLevel) {
        StringBuilder sql = new StringBuilder("SELECT * FROM gov_subject WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (LOWER(subject_name) LIKE ? OR LOWER(credit_code) LIKE ?)");
            String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
            args.add(like);
            args.add(like);
        }
        if (riskLevel != null && !riskLevel.isBlank() && !"all".equals(riskLevel)) {
            sql.append(" AND risk_level=?");
            args.add(riskLevel);
        }
        sql.append(" ORDER BY credit_score ASC, updated_at DESC");
        return jdbc.query(scope.sql(sql.toString()), subjectMapper(), args.toArray());
    }

    /**
     * 运营端：把监管档案绑到平台经营主体上。
     *
     * <p>没有这一步，主体端登录后只会得到"档案里没登记你的经营主体"——两条业务线各有一套主体，
     * 绑定关系必须由运营显式建立，不能靠名字猜（名字相同不等于同一家）。</p>
     */
    public Map<String, Object> bindMerchant(long subjectId, Object merchantIdValue) {
        Map<String, Object> subject = requireSubject(subjectId);
        if (merchantIdValue == null || String.valueOf(merchantIdValue).isBlank()) {
            jdbc.update("UPDATE gov_subject SET merchant_id=NULL, updated_at=? WHERE id=?",
                    TIME.format(LocalDateTime.now()), subjectId);
            audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "解除主体绑定",
                    String.valueOf(subject.get("subject_name")), "解除后该主体无法登录主体端查看档案", subjectId);
            return queryOne("SELECT * FROM gov_subject WHERE id=?", subjectMapper(), subjectId);
        }
        long merchantId;
        try {
            merchantId = Long.parseLong(String.valueOf(merchantIdValue).trim());
        } catch (NumberFormatException e) {
            throw BusinessException.validationError("经营主体号必须是数字，收到：" + merchantIdValue);
        }
        for (Map<String, Object> occupied : jdbc.queryForList(scope.sql(
                "SELECT subject_name FROM gov_subject WHERE merchant_id=? AND id<>?"), merchantId, subjectId)) {
            throw BusinessException.forbidden("经营主体 " + merchantId + " 已绑定监管档案《"
                    + occupied.get("subject_name") + "》，请先解除后再绑定");
        }
        jdbc.update("UPDATE gov_subject SET merchant_id=?, updated_at=? WHERE id=?",
                merchantId, TIME.format(LocalDateTime.now()), subjectId);
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "绑定经营主体",
                String.valueOf(subject.get("subject_name")), "绑定到平台经营主体 " + merchantId, subjectId);
        audit.notifySubject(subjectId, "subject", "监管档案已绑定平台主体",
                "本档案已关联平台经营主体 " + merchantId + "，该主体下的账号可以在监管服务端查看证照、整改与通知。",
                "SUBJECT", String.valueOf(subjectId));
        return queryOne("SELECT * FROM gov_subject WHERE id=?", subjectMapper(), subjectId);
    }

    public List<Map<String, Object>> warnings(String status) {
        if (status == null || status.isBlank() || "all".equals(status)) {
            return jdbc.query(scope.sql("SELECT * FROM gov_warning ORDER BY status='closed', id"), warningMapper());
        }
        return jdbc.query(scope.sql("SELECT * FROM gov_warning WHERE status=? ORDER BY id"), warningMapper(), status);
    }

    /**
     * 预警分派：承办人必须是档案里真实存在且在岗的执法人员，默认分给当前操作人。
     *
     * <p>原来 {@code assignedTo} 缺省值是常量 '王磊'，等于任何运营点一下"处置"都把活派给一个
     * 可能根本不存在的人，移动端也就永远显示那份任务。</p>
     */
    public Map<String, Object> handleWarning(long id, Map<String, Object> body) {
        scope.requireRecord("gov_warning", id, "inspection");
        String status = text(body, "status", "processing");
        String note = required(body, "note", "请填写处置意见");
        Map<String, Object> warning = queryOne("SELECT * FROM gov_warning WHERE id=?", warningMapper(), id);
        if (body.get("assigneeId") == null) {
            throw BusinessException.validationError("请指定承办执法人员（assigneeId）——预警不会自动落在某个固定的人身上");
        }
        Long assigneeId = resolveAssignee(body.get("assigneeId"), null);
        scope.requirePersonSubject(assigneeId, longValue(warning.get("subjectId")), "inspection");
        String assigneeName = assigneeId == null ? requireOperatorName() : inspectorName(assigneeId);
        int updated = jdbc.update("UPDATE gov_warning SET status=?,assigned_to=?,assignee_id=?,handle_note=? WHERE id=?",
                status, assigneeName, assigneeId, note, id);
        if (updated == 0) throw BusinessException.notFound("预警不存在");
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "预警处置",
                String.valueOf(warning.get("warningNo")), note, longValue(warning.get("subjectId")));
        if (assigneeId != null && !"closed".equals(status)) {
            audit.notifyInspector(assigneeId, "warning", "预警已分派给你",
                    "预警 " + warning.get("warningNo") + "（" + warning.get("level") + "级）已分派，处置意见：" + note,
                    "WARNING", String.valueOf(warning.get("warningNo")));
        }
        if (warning.get("subjectId") != null) {
            audit.notifySubject(longValue(warning.get("subjectId")), "warning", "监管预警提醒",
                    "你有一条" + warning.get("level") + "级监管预警：" + warning.get("title") + "，请配合核查。",
                    "WARNING", String.valueOf(warning.get("warningNo")));
        }
        return queryOne("SELECT * FROM gov_warning WHERE id=?", warningMapper(), id);
    }

    public List<Map<String, Object>> tasks(String status) {
        if (status == null || status.isBlank() || "all".equals(status)) {
            return jdbc.query(scope.sql("SELECT * FROM gov_task ORDER BY status='completed', created_at DESC"), taskMapper());
        }
        return jdbc.query(scope.sql("SELECT * FROM gov_task WHERE status=? ORDER BY created_at DESC"), taskMapper(), status);
    }

    /**
     * 创建执法任务：主体必须真实存在，承办人必须是档案里的执法人员，
     * 检查项按 {@code gov_check_item} 模板展开成逐项记录（详情页读这些行，不再返回写死的 8 条）。
     */
    public Map<String, Object> createTask(Map<String, Object> body) {
        scope.requireSubject(longValue(body.get("subjectId")), "inspection");
        String taskNo = "RW" + nowCompact();
        Map<String, Object> subject = requireSubject(longValue(body.get("subjectId"), 0L));
        Long assigneeId = resolveAssignee(body.get("assigneeId"), null);
        scope.requirePersonSubject(assigneeId, longValue(subject.get("id")), "inspection");
        String assigneeName = inspectorName(assigneeId);
        List<Map<String, Object>> items = activeCheckItems();
        if (items.isEmpty()) {
            throw BusinessException.forbidden("执法事项清单（gov_check_item）是空的，任务没有检查项可执行，请先由运营维护清单");
        }
        String deadline = text(body, "deadline", DATE.format(LocalDateTime.now().plusDays(1)) + " 18:00");
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO gov_task (task_no,task_type,subject_id,subject_name,address,distance_km,
                    deadline,priority,status,checklist_done,checklist_total,assigned_to,assignee_id,created_at)
                    VALUES (?,?,?,?,?,?,?,?,'pending',0,?,?,?,?)
                    """, Statement.RETURN_GENERATED_KEYS);
            int index = 1;
            statement.setString(index++, taskNo);
            statement.setString(index++, text(body, "taskType", "日常巡查"));
            statement.setLong(index++, longValue(subject.get("id")));
            statement.setString(index++, String.valueOf(subject.get("subject_name")));
            statement.setString(index++, text(body, "address", String.valueOf(subject.get("address"))));
            statement.setBigDecimal(index++, decimal(body.get("distanceKm"), BigDecimal.ZERO));
            statement.setString(index++, deadline);
            statement.setString(index++, text(body, "priority", "normal"));
            statement.setInt(index++, items.size());
            statement.setString(index++, assigneeName);
            statement.setLong(index++, assigneeId);
            statement.setString(index++, TIME.format(LocalDateTime.now()));
            return statement;
        }, keyHolder);
        Long taskId = keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
        for (Map<String, Object> item : items) {
            jdbc.update("INSERT INTO gov_task_check (task_id,item_id,item_name,note,done) VALUES (?,?,?, ?,FALSE)",
                    taskId, item.get("id"), item.get("itemName"), item.get("note"));
        }
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "创建执法任务", taskNo,
                "任务类型 " + text(body, "taskType", "日常巡查") + "，承办人 " + assigneeName,
                longValue(subject.get("id")));
        audit.notifyInspector(assigneeId, "task", "新的执法任务",
                "任务 " + taskNo + "（" + subject.get("subject_name") + "）已分派给你，截止 " + deadline
                        + "，检查项 " + items.size() + " 条。", "TASK", taskNo);
        return queryOne("SELECT * FROM gov_task WHERE task_no=?", taskMapper(), taskNo);
    }

    public List<Map<String, Object>> cases() {
        return jdbc.query(scope.sql("SELECT * FROM gov_case ORDER BY status='closed', filed_at DESC"), caseMapper());
    }

    /** 案件阶段推进：办案人取当前登录执法人员；结案时通知主体（这是主体的权利义务变化，不能只留在运营侧）。 */
    public Map<String, Object> advanceCase(long id, Map<String, Object> body) {
        scope.requireRecord("gov_case", id, "case");
        Map<String, Object> current = queryOne("SELECT * FROM gov_case WHERE id=?", caseMapper(), id);
        String status = text(body, "status", "investigating");
        int progress = switch (status) {
            case "filing" -> 20;
            case "investigating" -> 55;
            case "evidence" -> 70;
            case "decision" -> 88;
            case "closed" -> 100;
            default -> 50;
        };
        String allowed = String.valueOf(current.get("status"));
        if ("closed".equals(allowed)) {
            throw new BusinessException(409, "案件已办结，不能再推进阶段");
        }
        Long handlerId = resolveAssignee(body.get("handlerId"), longValue(current.get("handlerId")));
        scope.requirePersonSubject(handlerId, longValue(current.get("subjectId")), "case");
        int updated = jdbc.update("UPDATE gov_case SET status=?,stage_progress=?,handler=?,handler_id=?,"
                + "penalty_amount=?,closed_at=CASE WHEN ?='closed' THEN ? ELSE closed_at END WHERE id=?",
                status, progress, inspectorName(handlerId), handlerId,
                decimal(body.get("penaltyAmount"), (BigDecimal) current.get("penaltyAmount")), status,
                DATE.format(LocalDateTime.now()), id);
        if (updated == 0) throw BusinessException.notFound("案件不存在");
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "案件办理",
                String.valueOf(current.get("caseNo")), "案件进入 " + status + " 阶段",
                longValue(current.get("subjectId")));
        Long subjectId = longValue(current.get("subjectId"));
        if (subjectId != null) {
            if ("closed".equals(status)) {
                audit.notifySubject(subjectId, "case", "案件已办结",
                        "案件 " + current.get("caseNo") + " 已办结"
                                + (((BigDecimal) current.get("penaltyAmount")) != null
                                && ((BigDecimal) current.get("penaltyAmount")).signum() > 0
                                ? "，处罚金额 " + current.get("penaltyAmount") + " 元。" : "，未处以罚款。"),
                        "CASE", String.valueOf(current.get("caseNo")));
            } else if ("decision".equals(status)) {
                audit.notifySubject(subjectId, "case", "案件进入拟处罚告知",
                        "案件 " + current.get("caseNo") + " 已进入拟处罚决定阶段，如需陈述申辩请在处罚决定页提交意见。",
                        "CASE", String.valueOf(current.get("caseNo")));
            }
        }
        return queryOne("SELECT * FROM gov_case WHERE id=?", caseMapper(), id);
    }

    /** 整改台账（运营端复核队列）：默认待复核的排在前面。 */
    public List<Map<String, Object>> rectifications(String status) {
        if (status == null || status.isBlank() || "all".equals(status)) {
            return jdbc.query(scope.sql("SELECT * FROM gov_rectification ORDER BY status='closed', deadline"),
                    rectificationMapper());
        }
        return jdbc.query(scope.sql("SELECT * FROM gov_rectification WHERE status=? ORDER BY deadline"),
                rectificationMapper(), status);
    }

    /**
     * 整改复核：主体反馈后必须由监管结案或退回，否则整改永远停在"待复核"，
     * 主体的待办也不会消失（原来运营端根本没有这个动作）。
     */
    public Map<String, Object> reviewRectification(long id, Map<String, Object> body) {
        scope.requireRecord("gov_rectification", id, "inspection");
        Map<String, Object> row = queryOne("SELECT * FROM gov_rectification WHERE id=?", rectificationMapper(), id);
        String status = text(body, "status", "closed");
        if (!List.of("closed", "pending").contains(status)) {
            throw BusinessException.validationError("复核结论只能是「结案」或「退回重改」");
        }
        if (!"feedback".equals(String.valueOf(row.get("status")))) {
            throw new BusinessException(409, "只有主体已反馈的整改单可以复核，当前状态：" + row.get("status"));
        }
        String note = required(body, "note", "请填写复核意见");
        jdbc.update("UPDATE gov_rectification SET status=?,progress=?,feedback_text=? WHERE id=?",
                status, "closed".equals(status) ? 100 : 40,
                row.get("feedbackText") + "｜复核意见：" + note, id);
        Long subjectId = longValue(row.get("subjectId"));
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "整改复核",
                String.valueOf(row.get("rectificationNo")), note, subjectId);
        audit.notifySubject(subjectId, "rectification",
                "closed".equals(status) ? "整改已结案" : "整改被退回，需重新反馈",
                "整改单 " + row.get("rectificationNo") + " 复核结论：" + note,
                "RECTIFICATION", String.valueOf(row.get("rectificationNo")));
        return queryOne("SELECT * FROM gov_rectification WHERE id=?", rectificationMapper(), id);
    }

    public List<Map<String, Object>> repairs() {
        return jdbc.query(scope.sql("""
                SELECT r.*, s.subject_name FROM gov_credit_repair r
                LEFT JOIN gov_subject s ON s.id = r.subject_id
                ORDER BY r.status='approved', r.submitted_at DESC
                """), repairMapper());
    }

    public Map<String, Object> reviewRepair(long id, Map<String, Object> body) {
        scope.requireRecord("gov_credit_repair", id, "credit");
        Map<String, Object> repair = repairRow(id);
        String status = text(body, "status", "approved");
        if (!List.of("reviewing", "approved", "rejected").contains(status)) {
            throw BusinessException.validationError("复核结论不合法：" + status);
        }
        if ("approved".equals(String.valueOf(repair.get("status")))
                || "rejected".equals(String.valueOf(repair.get("status")))) {
            throw new BusinessException(409, "该修复申请已复核完成（" + repair.get("status") + "），不能重复改判");
        }
        int progress = "approved".equals(status) || "rejected".equals(status) ? 100 : 60;
        String note = required(body, "note", "请填写审核意见");
        jdbc.update("UPDATE gov_credit_repair SET status=?,progress=?,review_note=? WHERE id=?",
                status, progress, note, id);
        Long subjectId = longValue(repair.get("subjectId"));
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "信用修复复核",
                String.valueOf(repair.get("repairNo")), note, subjectId);
        audit.notifySubject(subjectId, "credit",
                "approved".equals(status) ? "信用修复已通过复核" : "信用修复未通过复核",
                "修复单 " + repair.get("repairNo") + " 复核意见：" + note
                        + ("rejected".equals(status) ? "（可补充材料后重新申请）" : ""),
                "REPAIR", String.valueOf(repair.get("repairNo")));
        return repairRow(id);
    }

    /** 修复单必须联表读：主体名要来自档案，缺了 JOIN 会直接报"列不存在"（原来这里返回的是写死的名字）。 */
    private Map<String, Object> repairRow(long id) {
        return queryOne("""
                SELECT r.*, s.subject_name FROM gov_credit_repair r
                LEFT JOIN gov_subject s ON s.id = r.subject_id
                WHERE r.id=?
                """, repairMapper(), id);
    }

    public List<Map<String, Object>> subsidies() {
        return jdbc.query(scope.sql("SELECT * FROM gov_subsidy ORDER BY status IN ('paid','rejected'), submitted_at DESC"),
                subsidyMapper());
    }

    public Map<String, Object> reviewSubsidy(long id, Map<String, Object> body) {
        scope.requireRecord("gov_subsidy", id, "subsidy");
        Map<String, Object> subsidy = queryOne("SELECT * FROM gov_subsidy WHERE id=?", subsidyMapper(), id);
        String status = text(body, "status", "county_review");
        int progress = switch (status) {
            case "submitted" -> 20;
            case "county_review" -> 70;
            case "paid", "rejected" -> 100;
            default -> 50;
        };
        if ("paid".equals(String.valueOf(subsidy.get("status")))
                || "rejected".equals(String.valueOf(subsidy.get("status")))) {
            throw new BusinessException(409, "该项目已办结（" + subsidy.get("status") + "），不能重复复核");
        }
        String remote = text(body, "remoteCheckStatus", "遥感核查通过");
        jdbc.update("UPDATE gov_subsidy SET status=?,progress=?,remote_check_status=? WHERE id=?",
                status, progress, remote, id);
        Long subjectId = longValue(subsidy.get("subjectId"));
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "补贴项目复核",
                String.valueOf(subsidy.get("applicationNo")), status + "／" + remote, subjectId);
        audit.notifySubject(subjectId, "subsidy",
                "paid".equals(status) ? "补贴已兑付" : "rejected".equals(status) ? "补贴申报未通过" : "补贴项目进入" + statusLabel(status),
                "申报 " + subsidy.get("applicationNo") + "（" + subsidy.get("projectName") + "）"
                        + "当前状态：" + statusLabel(status) + "；" + remote,
                "SUBSIDY", String.valueOf(subsidy.get("applicationNo")));
        return queryOne("SELECT * FROM gov_subsidy WHERE id=?", subsidyMapper(), id);
    }

    public List<Map<String, Object>> complaints() {
        return jdbc.query(scope.sql("SELECT * FROM gov_complaint ORDER BY status='resolved', created_at DESC"), complaintMapper());
    }

    public Map<String, Object> handleComplaint(long id, Map<String, Object> body) {
        scope.requireRecord("gov_complaint", id, "complaint");
        Map<String, Object> complaint = queryOne("SELECT * FROM gov_complaint WHERE id=?", complaintMapper(), id);
        String status = text(body, "status", "resolved");
        String note = required(body, "note", "请填写处理结论");
        jdbc.update("UPDATE gov_complaint SET status=?,handle_note=?,assigned_org=? WHERE id=?",
                status, note, text(body, "assignedOrg", String.valueOf(complaint.get("assignedOrg"))), id);
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "举报处理",
                String.valueOf(complaint.get("complaintNo")), note, null);
        // 被举报主体若已在档案里登记，处理结论要通知到它，否则主体永远不知道自己被举报且已结案
        String target = String.valueOf(complaint.get("targetName"));
        List<Long> matched = jdbc.queryForList(scope.sql("SELECT id FROM gov_subject WHERE subject_name=?"), Long.class, target);
        for (Long subjectId : matched) {
            audit.notifySubject(subjectId, "complaint",
                    "resolved".equals(status) ? "针对本主体的举报已办结" : "针对本主体的举报处理中",
                    "举报 " + complaint.get("complaintNo") + "（" + complaint.get("title") + "）处理结论：" + note,
                    "COMPLAINT", String.valueOf(complaint.get("complaintNo")));
        }
        return queryOne("SELECT * FROM gov_complaint WHERE id=?", complaintMapper(), id);
    }

    public List<Map<String, Object>> samplings() {
        return jdbc.query(scope.sql("SELECT * FROM gov_sampling ORDER BY sample_date DESC"), samplingMapper());
    }

    public Map<String, Object> createSampling(Map<String, Object> body) {
        scope.requireSubject(longValue(body.get("subjectId")), "sampling");
        String samplingNo = "CY" + nowCompact();
        Map<String, Object> subject = requireSubject(longValue(body.get("subjectId"), 0L));
        jdbc.update("""
                INSERT INTO gov_sampling (sampling_no,product_name,subject_id,subject_name,region,sample_date,
                test_items,result_text,disposition,public_flag)
                VALUES (?,?,?,?,?,?,?,?,?,TRUE)
                """, samplingNo, required(body, "productName", "请填写产品名称"),
                longValue(subject.get("id")), subject.get("subject_name"),
                text(body, "region", String.valueOf(subject.get("region"))),
                DATE.format(LocalDateTime.now()), text(body, "testItems", "农残常规检测"),
                text(body, "result", "待检"), text(body, "disposition", "等待检测结果"));
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "抽样送检", samplingNo,
                "创建监督抽检任务", longValue(subject.get("id")));
        audit.notifySubject(longValue(subject.get("id")), "sampling", "监督抽检任务已创建",
                "抽检单 " + samplingNo + "（" + body.get("productName") + "）已创建，检测结果出具后在此通知。",
                "SAMPLING", samplingNo);
        return queryOne("SELECT * FROM gov_sampling WHERE sampling_no=?", samplingMapper(), samplingNo);
    }

    public List<Map<String, Object>> dataShares() {
        return jdbc.query(scope.sql("SELECT * FROM gov_data_share ORDER BY id"), dataShareMapper());
    }

    public Map<String, Object> reviewDataShare(long id, Map<String, Object> body) {
        if (id >= 0) throw BusinessException.forbidden("共享资源尚未登记辖区，暂不允许审核");
        Map<String, Object> share = queryOne("SELECT * FROM gov_data_share WHERE id=?", dataShareMapper(), id);
        String status = text(body, "status", "approved");
        jdbc.update("UPDATE gov_data_share SET status=?,updated_at=? WHERE id=?",
                status, TIME.format(LocalDateTime.now()), id);
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "数据共享授权",
                "DS" + id, String.valueOf(share.get("resource_name")) + " → " + status, null);
        return queryOne("SELECT * FROM gov_data_share WHERE id=?", dataShareMapper(), id);
    }

    /**
     * 执法人员档案 ↔ 平台账号绑定。
     *
     * <p>移动执法端的所有"我的"口径都靠它：没有绑定，账号登录后要么被拒绝，
     * 要么（按原来的写法）被当成代码里那个写死的"王磊"。</p>
     */
    public Map<String, Object> bindPlatformUser(long userId, Object platformUserIdValue) {
        Map<String, Object> user = queryOne("SELECT * FROM gov_user WHERE id=?", (rs, rowNum) -> map(
                "id", rs.getLong("id"), "name", rs.getString("name"), "role", rs.getString("role_name")), userId);
        if (platformUserIdValue == null || String.valueOf(platformUserIdValue).isBlank()) {
            jdbc.update("UPDATE gov_user SET platform_user_id=NULL WHERE id=?", userId);
            audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "解除执法账号绑定",
                    String.valueOf(user.get("name")), "解除后该执法人员无法登录移动执法端", null);
            return users().stream().filter(item -> userId == ((Number) item.get("id")).longValue()).findFirst()
                    .orElse(Map.of());
        }
        long platformUserId;
        try {
            platformUserId = Long.parseLong(String.valueOf(platformUserIdValue).trim());
        } catch (NumberFormatException e) {
            throw BusinessException.validationError("平台用户号必须是数字，收到：" + platformUserIdValue);
        }
        for (Map<String, Object> occupied : jdbc.queryForList(scope.sql(
                "SELECT name FROM gov_user WHERE platform_user_id=? AND id<>?"), platformUserId, userId)) {
            throw BusinessException.forbidden("平台用户 " + platformUserId + " 已绑定执法人员档案《"
                    + occupied.get("name") + "》，请先解除");
        }
        jdbc.update("UPDATE gov_user SET platform_user_id=? WHERE id=?", platformUserId, userId);
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "绑定执法账号",
                String.valueOf(user.get("name")), "绑定平台用户 " + platformUserId, null);
        return users().stream().filter(item -> userId == ((Number) item.get("id")).longValue()).findFirst()
                .orElse(Map.of());
    }

    /** 执法人员档案：带上是否已绑定平台账号，运营一眼能看出谁登不进移动执法端。 */
    public List<Map<String, Object>> users() {
        return jdbc.query(scope.sql("SELECT * FROM gov_user ORDER BY id"), (rs, rowNum) -> map(
                "id", rs.getLong("id"), "name", rs.getString("name"), "role", rs.getString("role_name"),
                "organization", rs.getString("organization"), "grid", rs.getString("grid_name"),
                "certificateNo", rs.getString("certificate_no"),
                "platformUserId", rs.getObject("platform_user_id") == null
                        ? null : String.valueOf(rs.getObject("platform_user_id")),
                "status", rs.getString("status")));
    }

    public List<Map<String, Object>> logs() {
        return jdbc.query(scope.sql("SELECT * FROM gov_op_log ORDER BY id DESC LIMIT 200"), logMapper());
    }

    public Map<String, Object> statistics() { return scope.statistics(this::scopedStatistics); }
    private Map<String, Object> scopedStatistics() {
        return Map.of(
                "trend", jdbc.query(scope.sql("SELECT * FROM gov_daily_metric ORDER BY metric_date"), dailyMapper()),
                "warningTypes", jdbc.query(scope.sql("""
                        SELECT warning_type name, COUNT(*) value FROM gov_warning GROUP BY warning_type ORDER BY value DESC
                        """), (rs, rowNum) -> map("name", rs.getString("name"), "value", rs.getLong("value"))),
                "samplings", samplings(),
                "cases", cases(),
                "subjects", subjects(null, null)
        );
    }

    /* ==================== 移动执法端（当前登录执法人员） ==================== */

    public Map<String, Object> mobileWorkbench() {
        Map<String, Object> inspector = requireInspector();
        long inspectorId = ((Number) inspector.get("id")).longValue();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("todayTasks", number("SELECT COUNT(*) FROM gov_task WHERE assignee_id=?", inspectorId));
        stats.put("pendingTasks", number(
                "SELECT COUNT(*) FROM gov_task WHERE assignee_id=? AND status<>'completed'", inspectorId));
        stats.put("warnings", number(
                "SELECT COUNT(*) FROM gov_warning WHERE assignee_id=? AND status<>'closed'", inspectorId));
        stats.put("openCases", number(
                "SELECT COUNT(*) FROM gov_case WHERE handler_id=? AND status<>'closed'", inspectorId));
        List<Map<String, Object>> tasks = jdbc.query(scope.sql(
                "SELECT * FROM gov_task WHERE assignee_id=? ORDER BY status='completed', created_at DESC"),
                taskMapper(), inspectorId);
        List<Map<String, Object>> warnings = jdbc.query(scope.sql(
                "SELECT * FROM gov_warning WHERE assignee_id=? OR assignee_id IS NULL ORDER BY status='closed', id"),
                warningMapper(), inspectorId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inspector", Map.of(
                "name", String.valueOf(inspector.get("name")),
                "team", String.valueOf(inspector.get("organization")),
                "certificateNo", inspector.get("certificate_no") == null ? "未登记执法证号"
                        : String.valueOf(inspector.get("certificate_no")),
                "grid", inspector.get("grid_name") == null ? "未分配网格" : String.valueOf(inspector.get("grid_name")),
                "organization", String.valueOf(inspector.get("organization"))
        ));
        result.put("stats", stats);
        result.put("tasks", tasks);
        result.put("warnings", warnings);
        result.put("recentCases", jdbc.query(scope.sql(
                "SELECT * FROM gov_case WHERE handler_id=? ORDER BY status='closed', filed_at DESC LIMIT 4"),
                caseMapper(), inspectorId));
        // 原来的"离线取证 3 条"是常量；现在按取证记录里确实落库的条数给
        result.put("offlineRecords", number(
                "SELECT COUNT(*) FROM gov_evidence WHERE captured_by_id=? AND uploaded=FALSE", inspectorId));
        result.put("evidenceCount", number("SELECT COUNT(*) FROM gov_evidence WHERE captured_by_id=?", inspectorId));
        return result;
    }

    public List<Map<String, Object>> mobileTasks() {
        return jdbc.query(scope.sql("SELECT * FROM gov_task WHERE assignee_id=? ORDER BY status='completed', created_at DESC"),
                taskMapper(), requireInspectorId());
    }

    /** 任务详情：检查项读 {@code gov_task_check}（没有就按清单模板即时展开），不再返回代码里写死的 8 条。 */
    public Map<String, Object> mobileTask(long id) {
        Map<String, Object> task = requireAssignableTask(id);
        List<Map<String, Object>> checks = jdbc.query(scope.sql("""
                SELECT c.*, i.sort_order FROM gov_task_check c
                LEFT JOIN gov_check_item i ON i.id = c.item_id
                WHERE c.task_id=? ORDER BY COALESCE(i.sort_order, 99), c.id
                """), taskCheckMapper(), id);
        if (checks.isEmpty()) {
            for (Map<String, Object> item : activeCheckItems()) {
                jdbc.update("INSERT INTO gov_task_check (task_id,item_id,item_name,note,done) VALUES (?,?,?, ?,FALSE)",
                        id, item.get("id"), item.get("itemName"), item.get("note"));
            }
            jdbc.update("UPDATE gov_task SET checklist_total=? WHERE id=?", activeCheckItems().size(), id);
            checks = jdbc.query(scope.sql("""
                    SELECT c.*, i.sort_order FROM gov_task_check c
                    LEFT JOIN gov_check_item i ON i.id = c.item_id
                    WHERE c.task_id=? ORDER BY COALESCE(i.sort_order, 99), c.id
                    """), taskCheckMapper(), id);
        }
        task.put("checklist", checks);
        task.put("subject", queryOne("SELECT * FROM gov_subject WHERE id=?", subjectMapper(),
                longValue(task.get("subjectId"))));
        return task;
    }

    /**
     * 提交检查结果：逐项结论写回 {@code gov_task_check}，进度与状态按真实勾选数更新。
     *
     * <p>{@code checklist_done} 由实际勾选条数算出，不接受前端直接塞一个数 ——
     * 否则"8/8 已完成"可以是页面随手报出来的。</p>
     */
    public Map<String, Object> submitTask(long id, Map<String, Object> body) {
        Map<String, Object> task = requireAssignableTask(id);
        List<Map<String, Object>> answers = answersOf(body);
        if (answers.isEmpty()) {
            throw BusinessException.validationError("请至少提交一项检查结论");
        }
        LocalDateTime now = LocalDateTime.now();
        int done = 0;
        for (Map<String, Object> answer : answers) {
            boolean checked = Boolean.TRUE.equals(answer.get("done"));
            done += checked ? 1 : 0;
            int updated = jdbc.update("UPDATE gov_task_check SET done=?,note=?,checked_at=? WHERE task_id=? AND item_id=?",
                    checked, text(answer, "note", ""), TIME.format(now), id, answer.get("itemId"));
            if (updated == 0) {
                jdbc.update("INSERT INTO gov_task_check (task_id,item_id,item_name,note,done,checked_at) VALUES (?,?,?,?,?,?)",
                        id, answer.get("itemId"), text(answer, "itemName", "检查项"),
                        text(answer, "note", ""), checked, TIME.format(now));
            }
        }
        String result = required(body, "result", "请填写检查结论");
        jdbc.update("UPDATE gov_task SET checklist_done=?,checklist_total=?,status='completed',result_text=? WHERE id=?",
                done, answers.size(), result, id);
        Long subjectId = longValue(task.get("subjectId"));
        Long assigneeId = longValue(task.get("assigneeId"));
        audit.log(requireOperatorName(), assigneeId, identity.operatorRole(), "提交检查结果",
                String.valueOf(task.get("taskNo")), result + "（完成 " + done + "/" + answers.size() + " 项）",
                subjectId);
        if (subjectId != null) {
            audit.notifySubject(subjectId, "inspection", "现场检查已结束",
                    "任务 " + task.get("taskNo") + " 检查结论：" + result
                            + (done < answers.size() ? "（有 " + (answers.size() - done) + " 项未检查，可能转为责令改正）" : ""),
                    "TASK", String.valueOf(task.get("taskNo")));
        }
        return mobileTask(id);
    }

    /**
     * 执法端扫码核验。
     *
     * <p>先按主体信用代码查本域监管档案（这是监管自己的台账，合理），
     * 查不到就按溯源码去**生产域**核验 —— 这一段以前读的是本库 {@code gov_trace_event} 的
     * 5 行种子，"已上链"与否取决于种子里有没有填 {@code chain_hash}，与生产域真实存证无关。</p>
     *
     * <p>现在 {@code verified} 的口径是"码有效且节点都有 SUCCESS 存证"；
     * 节点存证情况、每条的存证状态与交易哈希都按真实记录给（没有就说没有）。</p>
     */
    public Map<String, Object> mobileScan(String code) {
        if (code == null || code.isBlank()) {
            throw BusinessException.validationError("请输入溯源码或主体信用代码");
        }
        requireInspectorId();
        String like = "%" + code.trim().toLowerCase(Locale.ROOT) + "%";
        List<Map<String, Object>> subjects = jdbc.query(scope.sql(
                "SELECT * FROM gov_subject WHERE LOWER(credit_code)=LOWER(?) OR credit_code LIKE ? LIMIT 3"),
                subjectMapper(), code.trim(), like);
        if (!subjects.isEmpty()) {
            return Map.of("type", "subject", "verified", true, "subject", subjects.get(0));
        }
        ProductionTraceClient.Verification verification;
        try {
            verification = traceSource.verify(code);
        } catch (BusinessException e) {
            // 只有"生产域确实没有这条码"才并进"未找到"这一句；
            // 服务不可达（503）必须原样报出去，否则页面会把故障显示成"这码是假的"。
            if (e.getCode() == 404) {
                throw BusinessException.notFound("未找到主体，生产域也没有这条溯源码：" + code.trim());
            }
            throw e;
        }
        if (verification != null) throw BusinessException.forbidden("跨域溯源尚未建立可核实的辖区映射，请使用公众溯源入口；执法核验暂不返回跨域明细");
        boolean effective = Boolean.TRUE.equals(verification.raw().get("verifiable"));
        boolean allOnChain = verification.nodeCount() > 0 && verification.onChainCount() == verification.nodeCount();
        Map<String, Object> result = new LinkedHashMap<>(verification.raw());
        result.put("type", "trace");
        result.put("verified", effective && allOnChain);
        result.put("chainedNodes", verification.onChainCount() + "/" + verification.nodeCount());
        result.put("nodeCount", verification.nodeCount());
        result.put("onChainCount", verification.onChainCount());
        result.put("attestedCount", verification.attestedCount());
        boolean expired = Boolean.TRUE.equals(verification.raw().get("expired"));
        // 与公众查询端共用一处状态映射：移动端以前直接透出 active/inactive 英文原值
        String statusText = ProductionTraceClient.statusText(
                String.valueOf(verification.raw().getOrDefault("status", "")), expired);
        result.put("statusText", statusText);
        result.put("events", verification.events());
        result.put("chainSummary", verification.conclusion()
                + (effective ? "" : "；该码当前状态为 " + statusText));
        return result;
    }

    public List<Map<String, Object>> mobileCases() {
        return jdbc.query(scope.sql("SELECT * FROM gov_case WHERE handler_id=? ORDER BY status='closed', filed_at DESC"),
                caseMapper(), requireInspectorId());
    }

    public Map<String, Object> createCase(Map<String, Object> body) {
        scope.requireSubject(longValue(body.get("subjectId")), "case");
        String caseNo = "AJ" + nowCompact();
        Map<String, Object> subject = requireSubject(longValue(body.get("subjectId"), 0L));
        Long handlerId = requireInspectorId();
        Long requestedHandler = longValue(body.get("handlerId"), handlerId);
        if (!handlerId.equals(requestedHandler)) throw BusinessException.forbidden("现场立案不能指定其他承办人");
        Long linkedTask = longValue(body.get("taskId"), null);
        if (linkedTask == null) throw BusinessException.forbidden("现场立案须关联本人承办任务");
        Long taskSubject = ownedSubject("gov_task", "assignee_id", linkedTask, handlerId);
        if (!taskSubject.equals(longValue(subject.get("id"))))
            throw BusinessException.forbidden("案件主体与承办任务不一致");
        jdbc.update("""
                INSERT INTO gov_case (case_no,task_id,subject_id,subject_name,case_type,summary,legal_basis,
                status,stage_progress,penalty_amount,handler,handler_id,filed_at)
                VALUES (?,?,?,?,?,?,?, 'filing',20,0,?,?,?)
                """, caseNo, longValue(body.get("taskId"), null), longValue(subject.get("id")),
                subject.get("subject_name"), text(body, "caseType", "现场检查发现"),
                required(body, "summary", "请填写案情摘要"), text(body, "legalBasis", "待匹配"),
                inspectorName(handlerId), handlerId, DATE.format(LocalDateTime.now()));
        audit.log(requireOperatorName(), handlerId, identity.operatorRole(), "立案登记", caseNo,
                String.valueOf(body.get("summary")), longValue(subject.get("id")));
        audit.notifySubject(longValue(subject.get("id")), "case", "已对你立案调查",
                "案件 " + caseNo + "（" + subject.get("subject_name") + "）已立案，案情：" + body.get("summary")
                        + "；如需陈述申辩可在处罚决定环节提交意见。", "CASE", caseNo);
        return queryOne("SELECT * FROM gov_case WHERE case_no=?", caseMapper(), caseNo);
    }

    /**
     * 现场取证：证据真的落库（编号、SHA-256 摘要、承办人、任务/案件归属），
     * 原来只往操作日志写一句话然后回一个由字符串 hashCode 生成的"证据哈希"。
     */
    private Long ownedSubject(String table, String ownerColumn, Long id, Long inspector) {
        scope.requireRecord(table, id, "gov_case".equals(table) ? "case" : "inspection");
        // 表名和列名仅由本类固定常量传入。
        List<Long> subjects = jdbc.queryForList(scope.sql("SELECT subject_id FROM " + table
                + " WHERE id=? AND " + ownerColumn + "=?"), Long.class, id, inspector);
        if (subjects.size() != 1 || subjects.get(0) == null)
            throw BusinessException.forbidden("关联记录不存在或不属于当前承办人");
        return subjects.get(0);
    }

    public Map<String, Object> addEvidence(Map<String, Object> body) {
        Long inspectorId = requireInspectorId();
        String evidenceNo = "ZJ" + nowCompact();
        String description = required(body, "description", "请填写取证说明");
        String taskNo = text(body, "taskNo", "");
        Long taskId = taskNo.isBlank() ? null : taskIdOf(taskNo);
        if (!taskNo.isBlank() && taskId == null) {
            throw BusinessException.notFound("取证关联的任务号不存在：" + taskNo);
        }
        Long caseId = longValue(body.get("caseId"), null);
        Long subjectId = null;
        if (taskId != null) subjectId = ownedSubject("gov_task", "assignee_id", taskId, inspectorId);
        if (caseId != null) {
            Long caseSubject = ownedSubject("gov_case", "handler_id", caseId, inspectorId);
            if (subjectId != null && !subjectId.equals(caseSubject))
                throw BusinessException.forbidden("证据关联的任务与案件主体不一致");
            subjectId = caseSubject;
        }
        if (subjectId == null) throw BusinessException.forbidden("证据须关联本人承办的任务或案件");
        String capturedAt = TIME.format(LocalDateTime.now());
        String hash = sha256(evidenceNo + "|" + description + "|" + capturedAt + "|" + inspectorId);
        boolean uploaded = Boolean.TRUE.equals(body.get("uploaded"));
        jdbc.update("""
                INSERT INTO gov_evidence (evidence_no,task_id,task_no,case_id,subject_id,evidence_type,
                description,evidence_hash,captured_by,captured_by_id,captured_at,uploaded,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, evidenceNo, taskId, text(body, "taskNo", ""), caseId, subjectId,
                text(body, "evidenceType", "现场照片"), description, hash,
                inspectorName(inspectorId), inspectorId, capturedAt, uploaded, capturedAt);
        audit.log(inspectorName(inspectorId), inspectorId, identity.operatorRole(), "现场取证",
                evidenceNo, description + "；证据摘要 " + hash, subjectId);
        return queryOne("SELECT * FROM gov_evidence WHERE evidence_no=?", evidenceMapper(), evidenceNo);
    }

    /** 取证记录列表（移动端的"证据"页），按当前执法人员过滤。 */
    public List<Map<String, Object>> myEvidence() {
        return jdbc.query(scope.sql("SELECT * FROM gov_evidence WHERE captured_by_id=? ORDER BY id DESC LIMIT 50"),
                evidenceMapper(), requireInspectorId());
    }

    /** 收件箱（移动端）：只取发给当前执法人员的消息。 */
    public List<Map<String, Object>> inspectorMessages() {
        return jdbc.query(scope.sql("SELECT * FROM gov_message WHERE assignee_id=? AND ((biz_type='TASK' AND biz_no IN (SELECT task_no FROM gov_task)) OR (biz_type='WARNING' AND biz_no IN (SELECT warning_no FROM gov_warning)) OR (biz_type='CASE' AND biz_no IN (SELECT case_no FROM gov_case))) ORDER BY id DESC"),
                messageMapper(), requireInspectorId());
    }

    public Map<String, Object> readInspectorMessages() {
        int count = jdbc.update(scope.sql("UPDATE gov_message SET is_read=TRUE WHERE assignee_id=? AND ((biz_type='TASK' AND biz_no IN (SELECT task_no FROM gov_task)) OR (biz_type='WARNING' AND biz_no IN (SELECT warning_no FROM gov_warning)) OR (biz_type='CASE' AND biz_no IN (SELECT case_no FROM gov_case))) AND is_read=FALSE"),
                requireInspectorId());
        return Map.of("updated", count);
    }

    public List<Map<String, Object>> checkItems() {
        return jdbc.query(scope.sql("SELECT * FROM gov_check_item ORDER BY sort_order, id"), checkItemMapper());
    }

    public Map<String, Object> saveCheckItem(Map<String, Object> body, Long id) {
        String name = required(body, "itemName", "请填写检查项名称");
        String note = text(body, "note", "");
        if (id == null) {
            jdbc.update("INSERT INTO gov_check_item (item_name,note,sort_order,status) VALUES (?,?,?, 'active')",
                    name, note, jdbc.queryForObject(scope.sql(
                            "SELECT COALESCE(MAX(sort_order),0)+1 FROM gov_check_item"), Integer.class));
            audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "执法事项清单启停",
                    name, "新增检查项", null);
            return queryOne("SELECT * FROM gov_check_item WHERE item_name=? ORDER BY id DESC LIMIT 1",
                    checkItemMapper(), name);
        } else {
            jdbc.update("UPDATE gov_check_item SET item_name=?,note=? WHERE id=?", name, note, id);
        }
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "维护执法事项清单",
                id == null ? "新增" : "修改", name, null);
        return queryOne("SELECT * FROM gov_check_item WHERE id=?", checkItemMapper(), id);
    }

    public Map<String, Object> toggleCheckItem(long id, boolean active) {
        Map<String, Object> item = queryOne("SELECT * FROM gov_check_item WHERE id=?", checkItemMapper(), id);
        jdbc.update("UPDATE gov_check_item SET status=? WHERE id=?", active ? "active" : "disabled", id);
        audit.log(requireOperatorName(), currentUserId(), identity.operatorRole(), "执法事项清单启停",
                String.valueOf(item.get("item_name")), active ? "启用" : "停用", null);
        return queryOne("SELECT * FROM gov_check_item WHERE id=?", checkItemMapper(), id);
    }

    /* ==================== 身份与工具 ==================== */

    private Map<String, Object> requireInspector() {
        Map<String, Object> inspector = identity.currentInspector();
        if (inspector == null) {
            throw BusinessException.forbidden("当前账号还没有绑定执法人员档案，无法使用移动执法端；"
                    + "请联系平台运营开通执法账号并在档案里绑定平台用户");
        }
        return inspector;
    }

    private long requireInspectorId() {
        return ((Number) requireInspector().get("id")).longValue();
    }

    /** 留痕里的操作人账号：执法人员用绑定的 gov_user.id，运营（没有执法档案）留空但姓名一定来自令牌。 */
    private Long currentUserId() {
        Map<String, Object> inspector = identity.currentInspector();
        return inspector == null ? null : ((Number) inspector.get("id")).longValue();
    }

    private String requireOperatorName() {
        String name = identity.operatorName();
        if (name == null || name.isBlank()) {
            throw BusinessException.forbidden("无法从访问令牌确定操作人，请重新登录");
        }
        return name;
    }

    private String inspectorName(Long inspectorId) {
        if (inspectorId == null) {
            return requireOperatorName();
        }
        List<String> names = jdbc.queryForList(scope.sql("SELECT name FROM gov_user WHERE id=?"), String.class, inspectorId);
        if (names.isEmpty()) {
            throw BusinessException.notFound("执法人员档案不存在：" + inspectorId);
        }
        return names.get(0);
    }

    /**
     * 解析承办人：显式指定必须是档案里在岗的执法人员；未指定时，
     * 移动端由当前执法人员承接，运营端必须点名（否则又回到"默认派给某个写死的人"）。
     */
    private Long resolveAssignee(Object requested, Object existing) {
        Long explicit = longValue(requested, null);
        if (explicit != null) {
            List<Map<String, Object>> rows = jdbc.queryForList(scope.sql(
                    "SELECT id, status FROM gov_user WHERE id=?"), explicit);
            if (rows.isEmpty()) {
                throw BusinessException.notFound("执法人员档案不存在：" + explicit);
            }
            if (!"active".equals(String.valueOf(rows.get(0).get("status")))) {
                throw BusinessException.forbidden("执法人员已停用，不能承接任务：" + explicit);
            }
            return explicit;
        }
        Long carried = longValue(existing, null);
        if (carried != null) {
            return carried;
        }
        // 只有真正有执法档案的账号才默认承接给自己的档案。
        // 用权限码判会误伤超管：通配 * 让 isInspector() 也为真，admin 建单就会被要求"先绑执法档案"。
        Map<String, Object> own = identity.currentInspector();
        if (own != null) {
            return ((Number) own.get("id")).longValue();
        }
        throw BusinessException.validationError("请指定承办执法人员（assigneeId）——"
                + "运营端不能默认把任务派给某个固定的人");
    }

    private Map<String, Object> requireAssignableTask(long id) {
        scope.requireRecord("gov_task", id, "inspection");
        Map<String, Object> task = queryOne("SELECT * FROM gov_task WHERE id=?", taskMapper(), id);
        if (identity.isInspector()) {
            long inspectorId = requireInspectorId();
            Long assignee = longValue(task.get("assigneeId"), null);
            if (assignee == null || assignee != inspectorId) {
                throw BusinessException.forbidden("该任务不属于当前执法人员，不能提交检查结果");
            }
        } else if (!identity.isOps()) {
            throw BusinessException.forbidden("只有执法人员或监管运营可以提交检查结果");
        }
        return task;
    }

    private Map<String, Object> requireSubject(long subjectId) {
        List<Map<String, Object>> rows = jdbc.queryForList(scope.sql("SELECT * FROM gov_subject WHERE id=?"), subjectId);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("监管主体档案不存在（subjectId=" + subjectId + "），请从主体台账里选择");
        }
        return rows.get(0);
    }

    private List<Map<String, Object>> activeCheckItems() {
        return jdbc.query(scope.sql("SELECT * FROM gov_check_item WHERE status='active' ORDER BY sort_order, id"),
                checkItemMapper());
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> answersOf(Map<String, Object> body) {
        Object raw = body.get("checks");
        List<Map<String, Object>> answers = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    answers.add(new LinkedHashMap<>((Map<String, Object>) map));
                }
            }
        }
        return answers;
    }

    private Long taskIdOf(String taskNo) {
        List<Long> ids = jdbc.queryForList(scope.sql("SELECT id FROM gov_task WHERE task_no=?"), Long.class, taskNo);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw BusinessException.error(com.agri.common.constant.ErrorCode.FAILURE,
                    "证据摘要生成失败，请重试：" + e.getMessage());
        }
    }

    private RowMapper<Map<String, Object>> subjectMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "subjectName", rs.getString("subject_name"),
                "creditCode", rs.getString("credit_code"), "subjectType", rs.getString("subject_type"),
                "legalPerson", rs.getString("legal_person"), "address", rs.getString("address"),
                "contactPhone", rs.getString("contact_phone"),
                "region", rs.getString("region"), "industry", rs.getString("industry"),
                "creditScore", rs.getInt("credit_score"), "creditLevel", rs.getString("credit_level"),
                "riskLevel", rs.getString("risk_level"), "supervisionStatus", rs.getString("supervision_status"),
                "annualReportStatus", rs.getString("annual_report_status"),
                "merchantId", rs.getObject("merchant_id") == null ? null : String.valueOf(rs.getObject("merchant_id")),
                "updatedAt", rs.getString("updated_at"));
    }

    private RowMapper<Map<String, Object>> warningMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "warningNo", rs.getString("warning_no"),
                "type", rs.getString("warning_type"), "level", rs.getString("level_name"),
                "subjectId", rs.getObject("subject_id"), "subjectName", rs.getString("subject_name"),
                "location", rs.getString("location"),
                "title", rs.getString("title"), "content", rs.getString("content"),
                "aiConfidence", rs.getInt("ai_confidence"), "status", rs.getString("status"),
                "assignedTo", rs.getString("assigned_to"), "assigneeId", rs.getObject("assignee_id"),
                "handleNote", rs.getString("handle_note"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> taskMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "taskNo", rs.getString("task_no"),
                "taskType", rs.getString("task_type"), "subjectId", rs.getObject("subject_id"),
                "subjectName", rs.getString("subject_name"),
                "address", rs.getString("address"), "distanceKm", rs.getBigDecimal("distance_km"),
                "deadline", rs.getString("deadline"), "priority", rs.getString("priority"),
                "status", rs.getString("status"), "checklistDone", rs.getInt("checklist_done"),
                "checklistTotal", rs.getInt("checklist_total"), "assignedTo", rs.getString("assigned_to"),
                "assigneeId", rs.getObject("assignee_id"),
                "result", rs.getString("result_text"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> caseMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "caseNo", rs.getString("case_no"),
                "subjectId", rs.getObject("subject_id"), "subjectName", rs.getString("subject_name"),
                "caseType", rs.getString("case_type"),
                "summary", rs.getString("summary"), "legalBasis", rs.getString("legal_basis"),
                "status", rs.getString("status"), "progress", rs.getInt("stage_progress"),
                "penaltyAmount", rs.getBigDecimal("penalty_amount"), "handler", rs.getString("handler"),
                "handlerId", rs.getObject("handler_id"),
                "filedAt", rs.getString("filed_at"), "closedAt", rs.getString("closed_at"));
    }

    private RowMapper<Map<String, Object>> rectificationMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "rectificationNo", rs.getString("rectification_no"),
                "subjectId", rs.getObject("subject_id"), "issueText", rs.getString("issue_text"),
                "requirement", rs.getString("requirement"),
                "deadline", rs.getString("deadline"), "status", rs.getString("status"),
                "progress", rs.getInt("progress"), "feedbackText", rs.getString("feedback_text"),
                "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> repairMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "repairNo", rs.getString("repair_no"),
                "subjectId", rs.getObject("subject_id"),
                "subjectName", rs.getString("subject_name"), "repairType", rs.getString("repair_type"),
                "reason", rs.getString("reason"), "status", rs.getString("status"),
                "progress", rs.getInt("progress"), "reviewNote", rs.getString("review_note"),
                "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> subsidyMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "applicationNo", rs.getString("application_no"),
                "subjectId", rs.getObject("subject_id"),
                "subjectName", rs.getString("subject_name"), "projectName", rs.getString("project_name"),
                "amount", rs.getBigDecimal("amount"), "status", rs.getString("status"),
                "progress", rs.getInt("progress"), "remoteCheckStatus", rs.getString("remote_check_status"),
                "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> complaintMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "complaintNo", rs.getString("complaint_no"),
                "type", rs.getString("complaint_type"), "title", rs.getString("title"),
                "content", rs.getString("content"), "anonymous", rs.getBoolean("anonymous"),
                "reporterName", rs.getString("reporter_name"), "targetName", rs.getString("target_name"),
                "status", rs.getString("status"), "priority", rs.getString("priority"),
                "assignedOrg", rs.getString("assigned_org"), "handleNote", rs.getString("handle_note"),
                "createdAt", timestamp(rs, "created_at"));
    }

    private RowMapper<Map<String, Object>> samplingMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "samplingNo", rs.getString("sampling_no"),
                "productName", rs.getString("product_name"), "subjectId", rs.getObject("subject_id"),
                "subjectName", rs.getString("subject_name"),
                "region", rs.getString("region"), "sampleDate", rs.getString("sample_date"),
                "testItems", rs.getString("test_items"), "result", rs.getString("result_text"),
                "disposition", rs.getString("disposition"));
    }

    private RowMapper<Map<String, Object>> dataShareMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "resourceName", rs.getString("resource_name"),
                "owner", rs.getString("owner_department"), "receiver", rs.getString("receiver_department"),
                "shareType", rs.getString("share_type"), "sensitiveLevel", rs.getString("sensitive_level"),
                "status", rs.getString("status"), "recordCount", rs.getInt("record_count"),
                "updatedAt", rs.getString("updated_at"));
    }

    private RowMapper<Map<String, Object>> dailyMapper() {
        return (rs, rowNum) -> map("date", rs.getString("metric_date"),
                "subjects", rs.getInt("subject_count"), "warnings", rs.getInt("warning_count"),
                "inspections", rs.getInt("inspection_count"), "samplingRate", rs.getBigDecimal("sampling_rate"),
                "cases", rs.getInt("case_count"), "tradeAmount", rs.getBigDecimal("trade_amount"));
    }

    private RowMapper<Map<String, Object>> logMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "operator", rs.getString("operator_name"),
                "operatorId", rs.getObject("operator_id"), "role", rs.getString("role_name"),
                "action", rs.getString("action_name"), "target", rs.getString("target_name"),
                "subjectId", rs.getObject("subject_id"), "detail", rs.getString("detail"),
                "ip", rs.getString("ip_address"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> messageMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "type", rs.getString("message_type"),
                "title", rs.getString("title"), "content", rs.getString("content"),
                "bizType", rs.getString("biz_type"), "bizNo", rs.getString("biz_no"),
                "read", rs.getBoolean("is_read"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> taskCheckMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "itemId", rs.getObject("item_id"),
                "itemName", rs.getString("item_name"), "note", rs.getString("note"),
                "done", rs.getBoolean("done"), "checkedAt", rs.getString("checked_at"));
    }

    private RowMapper<Map<String, Object>> checkItemMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "itemName", rs.getString("item_name"),
                "note", rs.getString("note"), "sortOrder", rs.getInt("sort_order"),
                "status", rs.getString("status"));
    }

    private RowMapper<Map<String, Object>> evidenceMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "evidenceNo", rs.getString("evidence_no"),
                "taskId", rs.getObject("task_id"), "taskNo", rs.getString("task_no"),
                "caseId", rs.getObject("case_id"), "subjectId", rs.getObject("subject_id"),
                "evidenceType", rs.getString("evidence_type"), "description", rs.getString("description"),
                "evidenceHash", rs.getString("evidence_hash"), "capturedBy", rs.getString("captured_by"),
                "capturedById", rs.getObject("captured_by_id"), "capturedAt", rs.getString("captured_at"),
                "uploaded", rs.getBoolean("uploaded"));
    }

    private Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }

    private Map<String, Object> todo(String route, String title, Object count, String description) {
        return Map.of("route", route, "title", title, "count", count, "description", description);
    }

    private String statusLabel(String status) {
        return switch (String.valueOf(status)) {
            case "submitted" -> "已提交";
            case "county_review" -> "区县复核";
            case "paid" -> "已兑付";
            case "rejected" -> "已驳回";
            default -> "处理中";
        };
    }

    private String timestamp(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        java.sql.Timestamp value = rs.getTimestamp(column);
        return value == null ? "" : value.toLocalDateTime().format(TIME);
    }

    private <T> T queryOne(String sql, RowMapper<T> mapper, Object... args) {
        List<T> rows = jdbc.query(scope.sql(sql), mapper, args);
        if (rows.isEmpty()) throw BusinessException.notFound("数据不存在");
        return rows.get(0);
    }

    private long number(String sql, Object... args) {
        Number value = jdbc.queryForObject(scope.sql(sql), Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    private Long longValue(Object value, Long fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return Long.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private long longValue(Object value) {
        Long parsed = longValue(value, null);
        return parsed == null ? 0L : parsed;
    }

    private BigDecimal decimal(Object value, BigDecimal fallback) {
        try {
            return value == null ? fallback : new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) throw BusinessException.validationError(message);
        return value;
    }

    private String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private String nowCompact() {
        long sequence = Math.floorMod(SERIAL.incrementAndGet(), 1000);
        return LocalDateTime.now().format(SERIAL_TIME) + String.format("%03d", sequence);
    }
}
