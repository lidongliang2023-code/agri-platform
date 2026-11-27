package com.agri.service.repository;

import com.agri.common.exception.BusinessException;
import com.agri.service.security.ServiceIdentityService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 专家本人履约域：身份取统一账号，问诊范围取专家绑定，通知回到需求方主体。 */
@Repository
public class ExpertRepository {
    private final JdbcTemplate jdbc;
    private final ServiceIdentityService identity;
    private final ServiceRepository service;
    public ExpertRepository(JdbcTemplate jdbc, ServiceIdentityService identity, ServiceRepository service) {
        this.jdbc = jdbc; this.identity = identity; this.service = service;
    }

    public Map<String, Object> profile() { return ownExpert(identity.verifiedUserId(), false); }

    private Map<String, Object> ownExpert(long userId, boolean lock) {
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT e.*, a.user_id, a.account_name FROM service_expert_account a
                JOIN service_expert e ON e.id=a.expert_id WHERE a.user_id=?
                """ + (lock ? " FOR UPDATE" : ""), expertMapper(), userId);
        if (rows.isEmpty()) throw BusinessException.forbidden("当前统一账号未绑定专家档案，请联系平台运营");
        Map<String, Object> expert = rows.get(0);
        if (!"available".equals(expert.get("status")))
            throw BusinessException.forbidden("专家档案当前已暂停接诊，请联系平台运营");
        return expert;
    }

    public List<Map<String, Object>> consultations() {
        long expertId = Long.parseLong(String.valueOf(profile().get("id")));
        return jdbc.query("""
                SELECT c.*, r.replied_at FROM service_consultation c
                LEFT JOIN service_consultation_reply r ON r.consultation_id=c.id
                WHERE c.expert_id=? ORDER BY CASE WHEN c.status='accepted' THEN 0 ELSE 1 END,c.id DESC
                """, consultationMapper(), expertId);
    }

    @Transactional
    public Map<String, Object> reply(long consultationId, Map<String, Object> body) {
        Object raw = body.get("content");
        String content = raw instanceof String ? ((String) raw).trim() : "";
        if (content.isBlank() || content.codePointCount(0, content.length()) > 1200)
            throw BusinessException.validationError("请填写 1 至 1200 字的专家回复");
        long userId = identity.verifiedUserId();
        Map<String, Object> expert = ownExpert(userId, true);
        long expertId = Long.parseLong(String.valueOf(expert.get("id")));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM service_consultation WHERE id=? AND expert_id=? FOR UPDATE", consultationId, expertId);
        if (rows.isEmpty()) throw BusinessException.notFound("问诊不存在或不属于当前专家");
        Map<String, Object> row = rows.get(0);
        if (!"accepted".equals(row.get("status")))
            throw BusinessException.validationError("该问诊已回复或当前状态不允许回复，请刷新列表");
        if (row.get("merchant_id") == null)
            throw BusinessException.validationError("问诊缺少所属主体，请先联系运营核实");
        int changed = jdbc.update("UPDATE service_consultation SET suggestion=?,status='answered' WHERE id=? AND expert_id=? AND status='accepted'",
                content, consultationId, expertId);
        if (changed != 1) throw BusinessException.validationError("问诊状态已变化，请刷新后重试");
        jdbc.update("""
                INSERT INTO service_consultation_reply(consultation_id,expert_id,user_id,expert_name,content)
                VALUES (?,?,?,?,?)
                """, consultationId, expertId, userId, expert.get("name"), content);
        service.notify(((Number) row.get("merchant_id")).longValue(), (String) row.get("merchant_name"),
                "consult", "专家已回复", "问诊 " + row.get("consult_no") + " 已由「" + expert.get("name")
                        + "」回复，请进入专家问诊查看完整意见。", "CONSULT", String.valueOf(row.get("consult_no")));
        audit(userId, "专家回复问诊", String.valueOf(row.get("consult_no")), "expertId=" + expertId + "; consultationId=" + consultationId);
        return jdbc.queryForObject("""
                SELECT c.*,r.replied_at FROM service_consultation c
                JOIN service_consultation_reply r ON r.consultation_id=c.id WHERE c.id=?
                """, consultationMapper(), consultationId);
    }

    public List<Map<String, Object>> experts() {
        return jdbc.query("""
                SELECT e.*,a.user_id,a.account_name FROM service_expert e
                LEFT JOIN service_expert_account a ON a.expert_id=e.id ORDER BY e.id
                """, expertMapper());
    }

    @Transactional
    public Map<String, Object> bind(long expertId, Map<String, Object> body) {
        if (!identity.isOps()) throw BusinessException.forbidden("需要综合服务运营权限");
        if (!body.containsKey("userId")) throw BusinessException.validationError("请提供统一账号编号，解绑请明确传 null");
        Long userId = null;
        Object value = body.get("userId");
        if (value != null) {
            try { userId = Long.valueOf(String.valueOf(value)); }
            catch (NumberFormatException e) { throw BusinessException.validationError("统一账号编号格式错误"); }
            if (userId <= 0) throw BusinessException.validationError("统一账号编号必须为正整数");
        }
        long operatorId = identity.verifiedUserId();
        String accountName = userId == null ? null : identity.activeAccountName(userId);
        List<Long> exists = jdbc.queryForList("SELECT id FROM service_expert WHERE id=? FOR UPDATE", Long.class, expertId);
        if (exists.isEmpty()) throw BusinessException.notFound("专家档案不存在");
        List<Long> old = jdbc.queryForList("SELECT user_id FROM service_expert_account WHERE expert_id=? FOR UPDATE", Long.class, expertId);
        jdbc.update("DELETE FROM service_expert_account WHERE expert_id=?", expertId);
        if (userId != null) {
            try {
                jdbc.update("INSERT INTO service_expert_account(expert_id,user_id,account_name,bound_by) VALUES(?,?,?,?)",
                        expertId, userId, accountName, operatorId);
            } catch (DuplicateKeyException e) { throw BusinessException.exists("该统一账号已绑定其他专家，不能重复绑定"); }
        }
        audit(operatorId, "专家账号绑定", "expertId=" + expertId, "原账号=" + old + "; 新账号=" + userId);
        return Map.of("expertId", String.valueOf(expertId), "bound", userId != null);
    }

    private void audit(long userId, String action, String target, String detail) {
        jdbc.update("""
                INSERT INTO service_op_log(operator_name,role_name,action_name,target_name,detail,ip_address,created_at)
                VALUES(?,?,?,?,?,?,?)
                """, "统一账号 " + userId, "专家问诊", action, target, detail, identity.clientIp(),
                java.time.LocalDateTime.now().toString());
    }

    private RowMapper<Map<String, Object>> expertMapper() {
        return (rs, n) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", String.valueOf(rs.getLong("id"))); m.put("name", rs.getString("name"));
            m.put("title", rs.getString("title")); m.put("status", rs.getString("status"));
            m.put("organization", rs.getString("organization")); m.put("category", rs.getString("category"));
            m.put("userId", rs.getObject("user_id") == null ? null : String.valueOf(rs.getLong("user_id")));
            m.put("accountName", rs.getString("account_name")); return m;
        };
    }
    private RowMapper<Map<String, Object>> consultationMapper() {
        return (rs,n) -> {
            Map<String,Object> m = new LinkedHashMap<>();
            m.put("id", String.valueOf(rs.getLong("id"))); m.put("consultNo", rs.getString("consult_no"));
            m.put("subject", rs.getString("subject")); m.put("content", rs.getString("content"));
            m.put("type", rs.getString("type")); m.put("status", rs.getString("status"));
            m.put("expertName", rs.getString("expert_name")); m.put("suggestion", rs.getString("suggestion"));
            m.put("aiLevel", rs.getString("ai_level")); m.put("createdAt", String.valueOf(rs.getTimestamp("created_at")));
            m.put("repliedAt", rs.getTimestamp("replied_at") == null ? null : rs.getTimestamp("replied_at").toString()); return m;
        };
    }
}
