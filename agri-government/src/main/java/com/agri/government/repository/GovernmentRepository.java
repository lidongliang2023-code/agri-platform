package com.agri.government.repository;

import com.agri.common.exception.BusinessException;
import com.agri.government.integration.ProductionTraceClient;
import com.agri.government.security.GovernmentIdentityService;
import com.agri.government.service.GovernmentAuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 主体端（gov:citizen）监管档案读写。
 *
 * <p>口径：这里的每一条数据都必须落在<b>当前登录账号对应的监管主体</b>上。
 * 原来 SQL 里到处写死 {@code subject_id=1}，任何账号登录看到的都是绿源蔬菜专业合作社的
 * 证照、整改、处罚与站内信 —— 页面显示得很正常，但范围根本不存在。</p>
 *
 * <p>工作台待办、合规自查维度与信用维度也都改成由真实记录算出来（证照在有效期比例、
 * 近 12 月报送期数、本主体抽检合格率、追溯记录上链比例、近 12 月处罚数与整改闭环率、
 * 针对本主体的举报办结率），不再是代码里的五段固定文案。</p>
 */
@Repository
public class GovernmentRepository {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter SERIAL_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final AtomicLong SERIAL = new AtomicLong();

    private final JdbcTemplate jdbc;
    private final GovernmentIdentityService identity;
    private final GovernmentAuditService audit;
    private final ProductionTraceClient traceSource;

    public GovernmentRepository(JdbcTemplate jdbc, GovernmentIdentityService identity,
                                GovernmentAuditService audit, ProductionTraceClient traceSource) {
        this.jdbc = jdbc;
        this.identity = identity;
        this.audit = audit;
        this.traceSource = traceSource;
    }

    public Map<String, Object> home() {
        long subjectId = identity.currentSubjectId();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("subject", subjectRow(subjectId));
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("creditScore", number("SELECT credit_score FROM gov_subject WHERE id=?", subjectId));
        stats.put("pendingTasks", number(
                "SELECT COUNT(*) FROM gov_rectification WHERE subject_id=? AND status<>'closed'", subjectId)
                + number("SELECT COUNT(*) FROM gov_subsidy WHERE subject_id=? AND status NOT IN ('paid','rejected')",
                        subjectId));
        stats.put("licenseAlerts", number(
                "SELECT COUNT(*) FROM gov_license WHERE subject_id=? AND status<>'valid'", subjectId));
        stats.put("unreadMessages", number(
                "SELECT COUNT(*) FROM gov_message WHERE subject_id=? AND is_read=FALSE", subjectId));
        result.put("stats", stats);
        result.put("todos", todos(subjectId));
        result.put("policies", policies(null).stream().limit(3).toList());
        result.put("publicNotices", jdbc.query("""
                SELECT * FROM gov_sampling WHERE subject_id=? AND public_flag=TRUE
                ORDER BY sample_date DESC LIMIT 3
                """, samplingMapper(), subjectId));
        return result;
    }

    public Map<String, Object> me() {
        return subjectRow(identity.currentSubjectId());
    }

    public List<Map<String, Object>> licenses() {
        return jdbc.query("SELECT * FROM gov_license WHERE subject_id=? ORDER BY id",
                licenseMapper(), identity.currentSubjectId());
    }

    public List<Map<String, Object>> reports() {
        return jdbc.query("SELECT * FROM gov_report WHERE subject_id=? ORDER BY submitted_at DESC",
                reportMapper(), identity.currentSubjectId());
    }

    /**
     * 数据报送。
     *
     * <p>AI 质量校验分不再是"95 + hash 取模"这种假随机：按报送内容是否填齐、描述是否具体（≥20 字）、
     * 报送期是否为当前期三件事打分，页面能看懂分数从哪来。链上哈希这里<b>不填</b> ——
     * 报送数据没有真的上链动作，写一个 0x... 只是装饰（要接链是溯源存证那条线的事）。</p>
     */
    public Map<String, Object> createReport(Map<String, Object> body) {
        long subjectId = identity.currentSubjectId();
        String reportNo = "SB" + nowCompact();
        String reportType = text(body, "reportType", "");
        String title = required(body, "title", "请填写报送标题");
        String description = required(body, "description", "请填写报送内容说明");
        String period = text(body, "period", currentMonth());
        int score = 55;
        score += reportType.isBlank() ? 0 : 15;
        score += Math.min(20, description.length() / 10);
        score += period.equals(currentMonth()) ? 10 : 0;
        score = Math.min(score, 100);
        jdbc.update("""
                INSERT INTO gov_report (report_no,subject_id,report_type,title,description,period_name,
                status,ai_score,submitted_at)
                VALUES (?,?,?, ?,?,?, 'verified',?,?)
                """, reportNo, subjectId, reportType.isBlank() ? "其他数据" : reportType,
                title, description, period, score, LocalDateTime.now());
        audit.log(identity.operatorName(), null, "经营主体", "数据报送", reportNo,
                "提交报送「" + title + "」，校验分 " + score, subjectId);
        audit.notifySubject(subjectId, "report", "数据报送已受理",
                "报送 " + reportNo + "（" + period + "）已完成 AI 质量校验，校验分 " + score + " 分。",
                "REPORT", reportNo);
        return queryOne("SELECT * FROM gov_report WHERE report_no=?", reportMapper(), reportNo);
    }

    public Map<String, Object> selfCheck() {
        long subjectId = identity.currentSubjectId();
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM gov_self_check WHERE subject_id=? ORDER BY checked_at DESC LIMIT 1",
                selfCheckMapper(), subjectId);
        Map<String, Object> result = rows.isEmpty() ? new LinkedHashMap<>() : new LinkedHashMap<>(rows.get(0));
        if (rows.isEmpty()) {
            result.put("checkNo", null);
            result.put("score", null);
            result.put("riskCount", 0);
            result.put("resultText", "还没有做过合规自查，点「发起 AI 合规自查」由监管数据现算。");
            result.put("items", List.of());
        }
        result.put("dimensions", complianceDimensions(subjectId));
        return result;
    }

    /** 自查分数由本主体的真实档案与记录算出，并把风险项写回库（页面显示的风险数与详情同源）。 */
    public Map<String, Object> runSelfCheck() {
        long subjectId = identity.currentSubjectId();
        List<Map<String, Object>> dimensions = complianceDimensions(subjectId);
        List<String> risks = new ArrayList<>();
        int total = 0;
        for (Map<String, Object> dimension : dimensions) {
            int score = ((Number) dimension.get("score")).intValue();
            total += score;
            if (score < 85) {
                risks.add(dimension.get("name") + "：" + dimension.get("detail"));
            }
        }
        int score = Math.round((float) total / dimensions.size());
        String checkNo = "ZC" + nowCompact();
        jdbc.update("""
                INSERT INTO gov_self_check (subject_id,check_no,score,risk_count,result_text,items_text,
                status,checked_at)
                VALUES (?,?,?,?,?,?,'completed',?)
                """, subjectId, checkNo, score, risks.size(),
                risks.isEmpty() ? "五个维度均达到 85 分以上，主体整体合规。"
                        : "存在 " + risks.size() + " 项低于 85 分的风险维度，详见风险清单。",
                String.join("|", risks), LocalDateTime.now());
        audit.log(identity.operatorName(), null, "经营主体", "AI合规自查", checkNo,
                "完成合规自查，得分 " + score + "，风险 " + risks.size() + " 项", subjectId);
        audit.notifySubject(subjectId, "self_check", "合规自查已完成",
                "自查 " + checkNo + " 得分 " + score + " 分" + (risks.isEmpty() ? "，无风险项。"
                        : "，发现 " + risks.size() + " 项风险，请查看待办清单。"),
                "SELF_CHECK", checkNo);
        return selfCheck();
    }

    public Map<String, Object> credit() {
        long subjectId = identity.currentSubjectId();
        Map<String, Object> subject = subjectRow(subjectId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", subject.get("creditScore"));
        result.put("level", subject.get("creditLevel"));
        result.put("riskLevel", subject.get("riskLevel"));
        result.put("updatedAt", subject.get("updatedAt"));
        result.put("dimensions", creditDimensions(subjectId));
        result.put("events", jdbc.query(
                "SELECT * FROM gov_credit_event WHERE subject_id=? ORDER BY event_date DESC",
                creditEventMapper(), subjectId));
        result.put("repairs", repairs());
        return result;
    }

    public List<Map<String, Object>> repairs() {
        return jdbc.query("SELECT * FROM gov_credit_repair WHERE subject_id=? ORDER BY submitted_at DESC",
                repairMapper(), identity.currentSubjectId());
    }

    public Map<String, Object> createRepair(Map<String, Object> body) {
        long subjectId = identity.currentSubjectId();
        String repairNo = "XF" + nowCompact();
        jdbc.update("""
                INSERT INTO gov_credit_repair (repair_no,subject_id,repair_type,reason,attachment_name,
                status,progress,submitted_at)
                VALUES (?,?,?,?,?, 'submitted',20,?)
                """, repairNo, subjectId, text(body, "repairType", "整改完成修复"),
                required(body, "reason", "请填写修复理由"), text(body, "attachmentName", "整改材料.pdf"),
                LocalDateTime.now());
        audit.log(identity.operatorName(), null, "经营主体", "信用修复申请", repairNo,
                "提交信用修复申请", subjectId);
        audit.notifySubject(subjectId, "credit", "信用修复申请已提交",
                "修复申请 " + repairNo + " 已提交，AI 预审通过后进入人工复核。", "REPAIR", repairNo);
        return queryOne("SELECT * FROM gov_credit_repair WHERE repair_no=?", repairMapper(), repairNo);
    }

    public List<Map<String, Object>> inspections() {
        return jdbc.query("SELECT * FROM gov_inspection WHERE subject_id=? ORDER BY inspection_date DESC",
                inspectionMapper(), identity.currentSubjectId());
    }

    public List<Map<String, Object>> rectifications() {
        return jdbc.query("SELECT * FROM gov_rectification WHERE subject_id=? ORDER BY submitted_at DESC",
                rectificationMapper(), identity.currentSubjectId());
    }

    /** 整改反馈只能落在自己名下的通知上：原来按 id 更新，换个 id 就能替别家提交整改材料。 */
    public Map<String, Object> feedbackRectification(long id, Map<String, Object> body) {
        long subjectId = identity.currentSubjectId();
        int updated = jdbc.update("""
                UPDATE gov_rectification SET feedback_text=?,status='feedback',progress=75
                WHERE id=? AND subject_id=?
                """, required(body, "feedback", "请填写整改反馈"), id, subjectId);
        if (updated == 0) {
            throw BusinessException.notFound("整改通知不存在，或它不属于当前经营主体");
        }
        String rectificationNo = jdbc.queryForObject("SELECT rectification_no FROM gov_rectification WHERE id=?",
                String.class, id);
        audit.log(identity.operatorName(), null, "经营主体", "整改反馈", rectificationNo,
                "提交整改材料与说明", subjectId);
        audit.notifySubject(subjectId, "rectification", "整改反馈已提交",
                "整改单 " + rectificationNo + " 的反馈材料已提交，等待监管复核（复核通过后结案）。",
                "RECTIFICATION", rectificationNo);
        return jdbc.queryForObject("SELECT * FROM gov_rectification WHERE id=?", rectificationMapper(), id);
    }

    public List<Map<String, Object>> penalties() {
        return jdbc.query("SELECT * FROM gov_penalty WHERE subject_id=? ORDER BY document_date DESC",
                penaltyMapper(), identity.currentSubjectId());
    }

    public Map<String, Object> submitStatement(long id, Map<String, Object> body) {
        long subjectId = identity.currentSubjectId();
        int updated = jdbc.update("""
                UPDATE gov_penalty SET statement_status='submitted',statement_text=?
                WHERE id=? AND subject_id=?
                """, required(body, "statement", "请填写陈述申辩意见"), id, subjectId);
        if (updated == 0) {
            throw BusinessException.notFound("处罚记录不存在，或它不属于当前经营主体");
        }
        String penaltyNo = jdbc.queryForObject("SELECT penalty_no FROM gov_penalty WHERE id=?", String.class, id);
        audit.log(identity.operatorName(), null, "经营主体", "陈述申辩", penaltyNo,
                "在线提交陈述申辩", subjectId);
        audit.notifySubject(subjectId, "penalty", "陈述申辩已提交",
                "处罚决定 " + penaltyNo + " 的陈述申辩意见已提交，处理结果将在复核后通知。",
                "PENALTY", penaltyNo);
        return jdbc.queryForObject("SELECT * FROM gov_penalty WHERE id=?", penaltyMapper(), id);
    }

    public List<Map<String, Object>> policies(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return jdbc.query("SELECT * FROM gov_policy ORDER BY publish_date DESC", policyMapper());
        }
        String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
        return jdbc.query("""
                SELECT * FROM gov_policy WHERE LOWER(title) LIKE ? OR LOWER(summary) LIKE ?
                OR LOWER(tags_text) LIKE ? ORDER BY publish_date DESC
                """, policyMapper(), like, like, like);
    }

    public List<Map<String, Object>> subsidies() {
        return jdbc.query("SELECT * FROM gov_subsidy WHERE subject_id=? ORDER BY submitted_at DESC",
                subsidyMapper(), identity.currentSubjectId());
    }

    /** 申报必须挂在真实存在、且仍在申报期内的政策上；主体号与名称一律取自当前档案。 */
    public Map<String, Object> createSubsidy(Map<String, Object> body) {
        long subjectId = identity.currentSubjectId();
        long policyId = longValue(body.get("policyId"), 0L);
        if (policyId <= 0) {
            throw BusinessException.validationError("请选择要申报的政策");
        }
        List<Map<String, Object>> policies = jdbc.queryForList("SELECT * FROM gov_policy WHERE id=?", policyId);
        if (policies.isEmpty()) {
            throw BusinessException.notFound("政策不存在，无法申报：" + policyId);
        }
        Map<String, Object> policy = policies.get(0);
        String status = String.valueOf(policy.get("status"));
        // 政策表的申报状态词表是 open（前端按 open 显示"申报中"），这里必须按真实词表判，
        // 判错会让所有正常申报都变成"不在申报期"
        if (!"open".equals(status)) {
            throw BusinessException.forbidden("政策《" + policy.get("title") + "》当前状态是「" + status
                    + "」，不在申报期内");
        }
        String deadline = policy.get("deadline") == null ? null : String.valueOf(policy.get("deadline"));
        boolean openEnded = deadline == null || deadline.isBlank() || "长期".equals(deadline);
        if (!openEnded && deadline.compareTo(DATE.format(LocalDateTime.now())) < 0) {
            throw BusinessException.forbidden("政策《" + policy.get("title") + "》的申报截止日是 " + deadline
                    + "，已过期");
        }
        BigDecimal amount = decimal(body.get("amount"), null);
        if (amount == null || amount.signum() <= 0) {
            throw BusinessException.validationError("请填写申报金额（必须大于 0）");
        }
        String applicationNo = "BT" + nowCompact();
        jdbc.update("""
                INSERT INTO gov_subsidy (application_no,policy_id,subject_id,subject_name,project_name,amount,
                status,progress,remote_check_status,submitted_at)
                VALUES (?,?,?,?,?,?, 'submitted',20,'待遥感核查',?)
                """, applicationNo, policyId, subjectId, subjectName(subjectId),
                required(body, "projectName", "请填写项目名称"), amount, LocalDateTime.now());
        audit.log(identity.operatorName(), null, "经营主体", "补贴项目申报", applicationNo,
                "申报《" + policy.get("title") + "》项目", subjectId);
        audit.notifySubject(subjectId, "subsidy", "补贴项目申报已受理",
                "项目「" + body.get("projectName") + "」申报 " + applicationNo + " 已受理，进入遥感核查。",
                "SUBSIDY", applicationNo);
        return queryOne("SELECT * FROM gov_subsidy WHERE application_no=?", subsidyMapper(), applicationNo);
    }

    public Map<String, Object> publicCredit(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            throw BusinessException.validationError("请输入企业名称或统一社会信用代码");
        }
        String like = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
        List<Map<String, Object>> result = jdbc.query("""
                SELECT * FROM gov_subject WHERE LOWER(subject_name) LIKE ? OR LOWER(credit_code) LIKE ?
                ORDER BY credit_score DESC LIMIT 8
                """, subjectMapper(), like, like);
        return Map.of("items", result, "query", keyword);
    }

    /**
     * 公众溯源核验：**读生产域的真实溯源码与链上存证**。
     *
     * <p>以前这条读的是本库 {@code gov_trace_event} 的 5 行种子（写死的
     * "种植/采收/加工/流通/销售"＋ {@code 0x1a2b3c0x} 假哈希），并且
     * {@code verified} 恒为 true —— 任何人输入任一个在这 5 行里的码，
     * 页面都会说"5 个节点已完成区块链核验，未发现时空逻辑异常"。</p>
     *
     * <p>现在的数据来源是生产域 {@code /trace/public/verify/{code}}：码是否存在、状态是否有效、
     * 有哪些链路节点、每个节点在 {@code agri_prod_chain_record} 里有没有真实存证记录、
     * 存证状态是 SUCCESS / PENDING / FAILED。生产域不可达时直接报 503，
     * 不退回种子表，也不把"没查到"显示成"核验通过"。</p>
     */
    public Map<String, Object> trace(String code) {
        ProductionTraceClient.Verification verification = traceSource.verify(code);
        Map<String, Object> result = new LinkedHashMap<>(verification.raw());
        boolean effective = Boolean.TRUE.equals(result.get("verifiable"));
        // 三态而不是两态：码无效 / 码有效但存证不全 / 码有效且节点全部已上链。
        // 以前这里 verified 恒为 true，页面上永远是一片绿。
        result.put("verified", effective && verification.nodeCount() > 0
                && verification.onChainCount() == verification.nodeCount());
        boolean expired = Boolean.TRUE.equals(result.get("expired"));
        // 状态文案与移动执法端共用一处映射（ProductionTraceClient#statusText），
        // 已过期一律显示"已过期"，不会出现"状态不是有效（当前：有效）"这种自相矛盾的话。
        result.put("statusText", ProductionTraceClient.statusText(
                String.valueOf(result.getOrDefault("status", "")), expired));
        result.put("events", verification.events());
        result.put("nodeCount", verification.nodeCount());
        result.put("onChainCount", verification.onChainCount());
        result.put("attestedCount", verification.attestedCount());
        result.put("chainSummary", (effective ? "" : "该码在生产域不可核验（当前状态："
                + result.getOrDefault("statusText", "未知") + "），") + verification.conclusion());
        return result;
    }

    public List<Map<String, Object>> samplings() {
        return jdbc.query("SELECT * FROM gov_sampling WHERE public_flag=TRUE ORDER BY sample_date DESC",
                samplingMapper());
    }

    public Map<String, Object> publicLists() {
        List<Map<String, Object>> subjects = jdbc.query("SELECT * FROM gov_subject ORDER BY credit_score DESC",
                subjectMapper());
        return Map.of(
                "red", subjects.stream().filter(item -> intValue(item.get("creditScore")) >= 92).limit(5).toList(),
                "black", subjects.stream().filter(item -> intValue(item.get("creditScore")) < 75).limit(5).toList()
        );
    }

    /**
     * 双公示。
     *
     * <p>原来这里返回的是 {@code licenses()}，也就是<b>当前登录主体自己的证照</b>：
     * 公示页是给别人看的，把登录者的档案当公示既不对也是泄露。改成跨主体的行政许可公示（带主体名），
     * 主体自己的证照仍走 {@code /licenses}。</p>
     */
    public Map<String, Object> publicity() {
        return Map.of(
                "licenses", jdbc.query("""
                        SELECT l.*, s.subject_name FROM gov_license l
                        JOIN gov_subject s ON s.id = l.subject_id
                        WHERE l.status='valid' ORDER BY l.expire_date
                        """, publicLicenseMapper()),
                "penalties", jdbc.query("SELECT * FROM gov_penalty WHERE public_flag=TRUE ORDER BY document_date DESC",
                        penaltyMapper())
        );
    }

    public List<Map<String, Object>> complaints() {
        long subjectId = identity.currentSubjectId();
        return jdbc.query("SELECT * FROM gov_complaint WHERE target_name=? ORDER BY created_at DESC",
                complaintMapper(), subjectName(subjectId));
    }

    public Map<String, Object> createComplaint(Map<String, Object> body) {
        long subjectId = identity.currentSubjectId();
        String complaintNo = "JB" + nowCompact();
        jdbc.update("""
                INSERT INTO gov_complaint (complaint_no,complaint_type,title,content,reporter_name,
                reporter_phone,anonymous,target_name,status,priority,assigned_org)
                VALUES (?,?,?,?,?,?,?, ?, 'accepted','normal',?)
                """, complaintNo, text(body, "complaintType", "其他"),
                required(body, "title", "请填写举报标题"), required(body, "content", "请填写举报内容"),
                text(body, "reporterName", "匿名用户"), text(body, "reporterPhone", ""),
                Boolean.TRUE.equals(body.get("anonymous")), subjectName(subjectId),
                text(body, "assignedOrg", "市农业农村局"));
        audit.log(identity.operatorName(), null, "经营主体", "投诉举报", complaintNo,
                "以「" + subjectName(subjectId) + "」名义提交举报线索", subjectId);
        audit.notifySubject(subjectId, "complaint", "举报线索已受理",
                "举报 " + complaintNo + " 已受理，处理结论会在此通知。", "COMPLAINT", complaintNo);
        return queryOne("SELECT * FROM gov_complaint WHERE complaint_no=?", complaintMapper(), complaintNo);
    }

    /** 收件箱按 subject_id 取（原来只按 user_type='subject' 一把捞，等于所有主体共用一个收件箱）。 */
    public List<Map<String, Object>> messages() {
        return jdbc.query("SELECT * FROM gov_message WHERE subject_id=? ORDER BY id DESC",
                messageMapper(), identity.currentSubjectId());
    }

    public Map<String, Object> readAll() {
        int count = jdbc.update("UPDATE gov_message SET is_read=TRUE WHERE subject_id=? AND is_read=FALSE",
                identity.currentSubjectId());
        return Map.of("updated", count);
    }

    /** 主体端只能看到与自己档案相关的留痕；全站操作日志在运营端。 */
    public List<Map<String, Object>> logs() {
        return jdbc.query("SELECT * FROM gov_op_log WHERE subject_id=? ORDER BY id DESC",
                logMapper(), identity.currentSubjectId());
    }

    /**
     * 工作台待办：由本主体真实存在的整改、修复、补贴与报送记录组成。
     *
     * <p>原来这里是四条写死的文案，所以"待办"永远不变、也和真实单据无关 ——
     * 用户按待办去处理，处理完待办还在。</p>
     */
    private List<Map<String, Object>> todos(long subjectId) {
        List<Map<String, Object>> todos = new ArrayList<>();
        String today = DATE.format(LocalDateTime.now());
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT * FROM gov_rectification WHERE subject_id=? AND status<>'closed' ORDER BY deadline",
                subjectId)) {
            String deadline = row.get("deadline") == null ? "" : String.valueOf(row.get("deadline"));
            boolean overdue = !deadline.isEmpty() && deadline.compareTo(today) < 0;
            todos.add(todo("rectification", overdue ? "责令改正已逾期" : "整改待处理",
                    String.valueOf(row.get("issue_text")), overdue ? "overdue" : "pending",
                    percent(row.get("progress"))));
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT * FROM gov_credit_repair WHERE subject_id=? AND status IN ('submitted','reviewing')",
                subjectId)) {
            todos.add(todo("credit", "信用修复" + statusLabel(String.valueOf(row.get("status"))),
                    "修复单 " + row.get("repair_no") + "：" + row.get("reason"), "reviewing",
                    percent(row.get("progress"))));
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT * FROM gov_subsidy WHERE subject_id=? AND status NOT IN ('paid','rejected')", subjectId)) {
            todos.add(todo("subsidy", "补贴项目" + statusLabel(String.valueOf(row.get("status"))),
                    String.valueOf(row.get("project_name")), String.valueOf(row.get("status")),
                    percent(row.get("progress"))));
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT * FROM gov_penalty WHERE subject_id=? AND statement_status='not_submitted'", subjectId)) {
            todos.add(todo("penalty", "处罚决定待陈述申辩", String.valueOf(row.get("violation_text")),
                    "pending", "0%"));
        }
        List<Map<String, Object>> latest = jdbc.queryForList(
                "SELECT * FROM gov_report WHERE subject_id=? ORDER BY submitted_at DESC LIMIT 1", subjectId);
        if (!latest.isEmpty()) {
            Map<String, Object> row = latest.get(0);
            todos.add(todo("report", "最近一次数据报送已完成",
                    row.get("period_name") + " 报送 " + row.get("report_no") + "，校验分 " + row.get("ai_score"),
                    "verified", "100%"));
        }
        return todos.stream().limit(6).toList();
    }

    /** 合规自查的五个维度：全部由本主体的真实记录计算，明细里写的就是算给它看的数字。 */
    private List<Map<String, Object>> complianceDimensions(long subjectId) {
        long licenses = count("SELECT COUNT(*) FROM gov_license WHERE subject_id=?", subjectId);
        long validLicenses = count("SELECT COUNT(*) FROM gov_license WHERE subject_id=? AND status='valid'", subjectId);
        int licenseScore = licenses == 0 ? 40 : (int) Math.round(100.0 * validLicenses / licenses);

        long reports = count("SELECT COUNT(*) FROM gov_report WHERE subject_id=? AND submitted_at>=?",
                subjectId, LocalDateTime.now().minusMonths(12));
        int reportScore = (int) Math.min(100, 55 + reports * 10);

        long samplings = count("SELECT COUNT(*) FROM gov_sampling WHERE subject_id=?", subjectId);
        long passed = count("SELECT COUNT(*) FROM gov_sampling WHERE subject_id=? AND result_text='合格'",
                subjectId);
        int qualityScore = samplings == 0 ? 80 : (int) Math.round(100.0 * passed / samplings);

        // 这里的 N/M 是本域归档表 gov_trace_event 的真实行数（不是编的），但它**不等于**生产域的
        // 实时存证状态：公众核验与执法扫码已经改成直接读生产域。所以文案要说清来源，
        // 别让"5 条追溯记录中 5 条带链上凭证"被当成链上事实。
        long traces = count("SELECT COUNT(*) FROM gov_trace_event WHERE subject_id=?", subjectId);
        long chained = count("SELECT COUNT(*) FROM gov_trace_event WHERE subject_id=? AND chain_hash IS NOT NULL",
                subjectId);
        int traceScore = traces == 0 ? 50 : (int) Math.round(100.0 * chained / traces);

        long penalties = count("SELECT COUNT(*) FROM gov_penalty WHERE subject_id=? AND document_date>=?",
                subjectId, LocalDateTime.now().minusMonths(12).format(DATE));
        long rectifications = count("SELECT COUNT(*) FROM gov_rectification WHERE subject_id=?", subjectId);
        long closedRectifications = count(
                "SELECT COUNT(*) FROM gov_rectification WHERE subject_id=? AND status='closed'", subjectId);
        int complianceScore = (int) Math.max(0, 100 - penalties * 20L
                - (rectifications - closedRectifications) * 8L);

        List<Map<String, Object>> dimensions = new ArrayList<>();
        dimensions.add(dimension("主体资质", licenseScore, licenses == 0
                ? "监管档案里没有登记证照"
                : licenses + " 本证照中 " + validLicenses + " 本在有效期内"));
        dimensions.add(dimension("生产记录", reportScore,
                "近 12 个月报送 " + reports + " 期"));
        dimensions.add(dimension("质量控制", qualityScore, samplings == 0
                ? "暂无监督抽检记录（按 80 分计）"
                : samplings + " 次抽检中 " + passed + " 次合格"));
        dimensions.add(dimension("追溯管理", traceScore, traces == 0
                ? "本域归档里还没有该主体的追溯事件"
                : "本域归档 " + traces + " 条追溯事件，其中 " + chained
                        + " 条登记了链上凭证（实时存证以生产域核验结果为准）"));
        dimensions.add(dimension("信用合规", complianceScore,
                "近 12 个月新增处罚 " + penalties + " 件，整改 " + closedRectifications + "/" + rectifications + " 已闭环"));
        return dimensions;
    }

    /** 信用画像的五个维度：与合规自查同源但口径不同（守法与社评看的是外部记录）。 */
    private List<Map<String, Object>> creditDimensions(long subjectId) {
        List<Map<String, Object>> compliance = complianceDimensions(subjectId);
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map<String, Object> item : compliance) {
            result.put(String.valueOf(item.get("name")), item);
        }
        String subjectName = subjectName(subjectId);
        long complaints = count("SELECT COUNT(*) FROM gov_complaint WHERE target_name=?", subjectName);
        long resolved = count("SELECT COUNT(*) FROM gov_complaint WHERE target_name=? AND status='resolved'",
                subjectName);
        int socialScore = complaints == 0 ? 95
                : (int) Math.max(40, Math.round(100.0 * resolved / complaints) - (complaints - resolved) * 10);
        long events = count("SELECT COUNT(*) FROM gov_credit_event WHERE subject_id=?", subjectId);

        List<Map<String, Object>> dimensions = new ArrayList<>();
        dimensions.add(dimension("登记与许可", score(result, "主体资质"),
                detail(result, "主体资质") + "；主体登记信息与监管档案一致"));
        dimensions.add(dimension("质量管理", score(result, "质量控制"),
                detail(result, "质量控制") + "；最近一次合规自查 " + lastSelfCheckScore(subjectId) + " 分"));
        dimensions.add(dimension("履约与追溯", score(result, "追溯管理"),
                detail(result, "追溯管理") + "；" + detail(result, "生产记录")));
        dimensions.add(dimension("守法合规", score(result, "信用合规"),
                detail(result, "信用合规") + "；信用事件 " + events + " 条"));
        dimensions.add(dimension("社会评价", socialScore, complaints == 0
                ? "暂无针对本主体的举报"
                : "针对本主体举报 " + complaints + " 件，已办结 " + resolved + " 件"));
        return dimensions;
    }

    private int score(Map<String, Object> dimensions, String name) {
        Map<String, Object> item = (Map<String, Object>) dimensions.get(name);
        return item == null ? 0 : ((Number) item.get("score")).intValue();
    }

    private String detail(Map<String, Object> dimensions, String name) {
        Map<String, Object> item = (Map<String, Object>) dimensions.get(name);
        return item == null ? "无数据" : String.valueOf(item.get("detail"));
    }

    private String lastSelfCheckScore(long subjectId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT score FROM gov_self_check WHERE subject_id=? ORDER BY checked_at DESC LIMIT 1", subjectId);
        return rows.isEmpty() ? "未做过" : String.valueOf(rows.get(0).get("score"));
    }

    private Map<String, Object> subjectRow(long subjectId) {
        return queryOne("SELECT * FROM gov_subject WHERE id=?", subjectMapper(), subjectId);
    }

    private String subjectName(long subjectId) {
        return jdbc.queryForObject("SELECT subject_name FROM gov_subject WHERE id=?", String.class, subjectId);
    }

    private long count(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    private RowMapper<Map<String, Object>> subjectMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getLong("id"));
            item.put("subjectName", rs.getString("subject_name"));
            item.put("creditCode", rs.getString("credit_code"));
            item.put("subjectType", rs.getString("subject_type"));
            item.put("legalPerson", rs.getString("legal_person"));
            item.put("contactPhone", rs.getString("contact_phone"));
            item.put("address", rs.getString("address"));
            item.put("region", rs.getString("region"));
            item.put("industry", rs.getString("industry"));
            item.put("scale", rs.getString("scale_text"));
            item.put("creditScore", rs.getInt("credit_score"));
            item.put("creditLevel", rs.getString("credit_level"));
            item.put("riskLevel", rs.getString("risk_level"));
            item.put("supervisionStatus", rs.getString("supervision_status"));
            item.put("certificationStatus", rs.getString("certification_status"));
            item.put("annualReportStatus", rs.getString("annual_report_status"));
            Object merchant = rs.getObject("merchant_id");
            item.put("merchantId", merchant == null ? null : String.valueOf(merchant));
            item.put("updatedAt", rs.getString("updated_at"));
            return item;
        };
    }

    private RowMapper<Map<String, Object>> licenseMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "licenseName", rs.getString("license_name"),
                "licenseNo", rs.getString("license_no"), "authority", rs.getString("authority"),
                "issueDate", rs.getString("issue_date"), "expireDate", rs.getString("expire_date"),
                "status", rs.getString("status"), "attachmentName", rs.getString("attachment_name"));
    }

    /** 公示用的证照列表：必须带"是谁家的"，否则公示页只是一堆没有归属的证书名。 */
    private RowMapper<Map<String, Object>> publicLicenseMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "licenseName", rs.getString("license_name"),
                "licenseNo", rs.getString("license_no"), "authority", rs.getString("authority"),
                "issueDate", rs.getString("issue_date"), "expireDate", rs.getString("expire_date"),
                "status", rs.getString("status"), "subjectName", rs.getString("subject_name"));
    }

    private RowMapper<Map<String, Object>> reportMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "reportNo", rs.getString("report_no"),
                "reportType", rs.getString("report_type"), "title", rs.getString("title"),
                "description", rs.getString("description"), "period", rs.getString("period_name"),
                "status", rs.getString("status"), "aiScore", rs.getInt("ai_score"),
                "chainHash", rs.getString("chain_hash"), "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> selfCheckMapper() {
        return (rs, rowNum) -> {
            String items = rs.getString("items_text");
            return map("id", rs.getLong("id"), "checkNo", rs.getString("check_no"),
                    "score", rs.getInt("score"), "riskCount", rs.getInt("risk_count"),
                    "resultText", rs.getString("result_text"),
                    "items", items == null || items.isBlank() ? List.of() : List.of(items.split("\\|")));
        };
    }

    private RowMapper<Map<String, Object>> creditEventMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "eventType", rs.getString("event_type"),
                "title", rs.getString("title"), "scoreChange", rs.getInt("score_change"),
                "detail", rs.getString("detail"), "source", rs.getString("source_name"),
                "eventDate", rs.getString("event_date"), "publicFlag", rs.getBoolean("public_flag"));
    }

    private RowMapper<Map<String, Object>> repairMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "repairNo", rs.getString("repair_no"),
                "repairType", rs.getString("repair_type"), "reason", rs.getString("reason"),
                "attachmentName", rs.getString("attachment_name"), "status", rs.getString("status"),
                "progress", rs.getInt("progress"), "reviewNote", rs.getString("review_note"),
                "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> inspectionMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "inspectionNo", rs.getString("inspection_no"),
                "subjectName", rs.getString("subject_name"), "inspectionType", rs.getString("inspection_type"),
                "inspectors", rs.getString("inspectors"), "resultText", rs.getString("result_text"),
                "riskCount", rs.getInt("risk_count"), "status", rs.getString("status"),
                "inspectionDate", rs.getString("inspection_date"), "chainHash", rs.getString("chain_hash"));
    }

    private RowMapper<Map<String, Object>> rectificationMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "rectificationNo", rs.getString("rectification_no"),
                "issueText", rs.getString("issue_text"), "requirement", rs.getString("requirement"),
                "deadline", rs.getString("deadline"), "status", rs.getString("status"),
                "progress", rs.getInt("progress"), "feedbackText", rs.getString("feedback_text"),
                "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> penaltyMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "penaltyNo", rs.getString("penalty_no"),
                "subjectName", rs.getString("subject_name"), "violationText", rs.getString("violation_text"),
                "legalBasis", rs.getString("legal_basis"), "penaltyText", rs.getString("penalty_text"),
                "amount", rs.getBigDecimal("amount"), "documentDate", rs.getString("document_date"),
                "statementStatus", rs.getString("statement_status"), "statementText", rs.getString("statement_text"),
                "publicFlag", rs.getBoolean("public_flag"), "status", rs.getString("status"));
    }

    private RowMapper<Map<String, Object>> policyMapper() {
        return (rs, rowNum) -> {
            String tags = rs.getString("tags_text");
            return map("id", rs.getLong("id"), "title", rs.getString("title"),
                    "level", rs.getString("policy_level"), "category", rs.getString("category"),
                    "authority", rs.getString("issuing_authority"), "policyNo", rs.getString("policy_no"),
                    "summary", rs.getString("summary"), "content", rs.getString("content_text"),
                    "publishDate", rs.getString("publish_date"), "effectiveDate", rs.getString("effective_date"),
                    "deadline", rs.getString("deadline"), "status", rs.getString("status"),
                    "tags", tags == null || tags.isBlank() ? List.of() : List.of(tags.split("\\+")));
        };
    }

    private RowMapper<Map<String, Object>> subsidyMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "applicationNo", rs.getString("application_no"),
                "policyId", rs.getLong("policy_id"), "projectName", rs.getString("project_name"),
                "amount", rs.getBigDecimal("amount"), "status", rs.getString("status"),
                "progress", rs.getInt("progress"), "remoteCheckStatus", rs.getString("remote_check_status"),
                "submittedAt", timestamp(rs, "submitted_at"));
    }

    private RowMapper<Map<String, Object>> samplingMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "samplingNo", rs.getString("sampling_no"),
                "productName", rs.getString("product_name"), "subjectName", rs.getString("subject_name"),
                "region", rs.getString("region"), "sampleDate", rs.getString("sample_date"),
                "testItems", rs.getString("test_items"), "result", rs.getString("result_text"),
                "disposition", rs.getString("disposition"), "publicFlag", rs.getBoolean("public_flag"));
    }

    private RowMapper<Map<String, Object>> complaintMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "complaintNo", rs.getString("complaint_no"),
                "complaintType", rs.getString("complaint_type"), "title", rs.getString("title"),
                "content", rs.getString("content"), "reporterName", rs.getString("reporter_name"),
                "reporterPhone", rs.getString("reporter_phone"), "anonymous", rs.getBoolean("anonymous"),
                "targetName", rs.getString("target_name"), "status", rs.getString("status"),
                "priority", rs.getString("priority"), "assignedOrg", rs.getString("assigned_org"),
                "handleNote", rs.getString("handle_note"), "createdAt", timestamp(rs, "created_at"));
    }

    private RowMapper<Map<String, Object>> messageMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "type", rs.getString("message_type"),
                "title", rs.getString("title"), "content", rs.getString("content"),
                "bizType", rs.getString("biz_type"), "bizNo", rs.getString("biz_no"),
                "read", rs.getBoolean("is_read"), "createdAt", rs.getString("created_at"));
    }

    private RowMapper<Map<String, Object>> logMapper() {
        return (rs, rowNum) -> map("id", rs.getLong("id"), "operator", rs.getString("operator_name"),
                "role", rs.getString("role_name"), "action", rs.getString("action_name"),
                "target", rs.getString("target_name"), "subjectId", rs.getObject("subject_id"),
                "detail", rs.getString("detail"),
                "ip", rs.getString("ip_address"), "createdAt", rs.getString("created_at"));
    }

    private Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }

    private Map<String, Object> dimension(String name, int score, String detail) {
        return Map.of("name", name, "score", score, "detail", detail);
    }

    private Map<String, Object> todo(String route, String title, String content, String status, String progress) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("route", route);
        item.put("title", title);
        item.put("content", content == null ? "" : content);
        item.put("status", status);
        item.put("progress", progress);
        return item;
    }

    private String percent(Object value) {
        int progress = value instanceof Number number ? number.intValue() : 0;
        return progress + "%";
    }

    private String statusLabel(String status) {
        return switch (String.valueOf(status)) {
            case "submitted" -> "已提交待预审";
            case "reviewing" -> "人工复核中";
            case "county_review" -> "区县复核中";
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
        List<T> rows = jdbc.query(sql, mapper, args);
        if (rows.isEmpty()) throw BusinessException.notFound("数据不存在");
        return rows.get(0);
    }

    private long number(String sql, Object... args) {
        return count(sql, args);
    }

    private int intValue(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    private long longValue(Object value, long fallback) {
        try {
            return value == null ? fallback : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private BigDecimal decimal(Object value, BigDecimal fallback) {
        try {
            return value == null ? fallback : new BigDecimal(String.valueOf(value).trim())
                    .setScale(2, RoundingMode.HALF_UP);
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

    private String currentMonth() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }
}
