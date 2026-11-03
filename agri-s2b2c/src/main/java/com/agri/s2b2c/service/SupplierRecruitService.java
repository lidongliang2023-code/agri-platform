package com.agri.s2b2c.service;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** 供应商招募：邀请码校验、渠道入驻绑定与审核联动。 */
@Service
public class SupplierRecruitService {

    private final JdbcTemplate jdbc;

    public SupplierRecruitService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> validate(String code) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, supplier_id AS supplierId, channel_limit AS channelLimit, used_count AS usedCount, "
                        + "expire_at AS expireAt, status FROM s2b2c_supplier_invite WHERE code = ?", code);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("邀请码不存在");
        }
        Map<String, Object> invite = rows.get(0);
        if (!"ACTIVE".equals(String.valueOf(invite.get("status")))) {
            throw new IllegalArgumentException("邀请码已停用");
        }
        Object expireAt = invite.get("expireAt");
        if (expireAt != null) {
            java.time.LocalDateTime expire = expireAt instanceof java.sql.Timestamp ts
                    ? ts.toLocalDateTime() : (java.time.LocalDateTime) expireAt;
            if (expire.isBefore(java.time.LocalDateTime.now())) {
                throw new IllegalArgumentException("邀请码已过期");
            }
        }
        int limit = invite.get("channelLimit") == null ? 0 : ((Number) invite.get("channelLimit")).intValue();
        int used = invite.get("usedCount") == null ? 0 : ((Number) invite.get("usedCount")).intValue();
        if (limit > 0 && used >= limit) {
            throw new IllegalArgumentException("邀请码已达使用上限");
        }
        return invite;
    }

    @Transactional
    public void bindAfterApply(String code, Long channelId) {
        Map<String, Object> invite = validate(code);
        Long supplierId = ((Number) invite.get("supplierId")).longValue();
        jdbc.update("INSERT INTO s2b2c_supplier_recruit (id, supplier_id, channel_id, invite_code, status, create_time) "
                        + "VALUES (?,?,?,?, 'PENDING', NOW()) ON DUPLICATE KEY UPDATE invite_code = VALUES(invite_code), "
                        + "status = 'PENDING', update_time = NOW()",
                IdWorker.getId(), supplierId, channelId, code);
        jdbc.update("UPDATE s2b2c_supplier_invite SET used_count = used_count + 1 WHERE code = ?", code);
    }

    @Transactional
    public void onChannelAudit(Long channelId, boolean approved) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, invite_code AS inviteCode FROM s2b2c_supplier_recruit "
                        + "WHERE channel_id = ? AND status = 'PENDING' ORDER BY create_time DESC LIMIT 1", channelId);
        if (rows.isEmpty()) return;
        Map<String, Object> recruit = rows.get(0);
        String status = approved ? "APPROVED" : "REJECTED";
        jdbc.update("UPDATE s2b2c_supplier_recruit SET status = ?, update_time = NOW() WHERE id = ?",
                status, recruit.get("id"));
        if (!approved && recruit.get("inviteCode") != null) {
            jdbc.update("UPDATE s2b2c_supplier_invite SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?",
                    recruit.get("inviteCode"));
        }
    }
}
