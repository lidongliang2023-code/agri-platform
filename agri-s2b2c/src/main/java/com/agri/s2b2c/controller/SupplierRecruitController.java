package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.service.SupplierIdentityService;
import com.agri.s2b2c.service.SupplierRecruitService;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 供应商分销商招募：邀请码与招募关系。 */
@RestController
@RequestMapping("/api/supplier")
@OperatorOnly("s2b2c:supplier")
public class SupplierRecruitController {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final SupplierIdentityService supplierIdentityService;
    private final SupplierRecruitService recruitService;

    public SupplierRecruitController(JdbcTemplate jdbc, SupplierIdentityService supplierIdentityService,
                                     SupplierRecruitService recruitService) {
        this.jdbc = jdbc;
        this.supplierIdentityService = supplierIdentityService;
        this.recruitService = recruitService;
    }

    @GetMapping("/invites")
    public ResponseEntity<List<Map<String, Object>>> invites() {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(jdbc.queryForList(
                "SELECT id, code, channel_limit AS channelLimit, used_count AS usedCount, expire_at AS expireAt, "
                        + "status, create_time AS createTime FROM s2b2c_supplier_invite "
                        + "WHERE supplier_id = ? ORDER BY create_time DESC", supplier.getId()));
    }

    @PostMapping("/invites")
    public ResponseEntity<Map<String, Object>> createInvite(@RequestBody Map<String, Object> body) {
        Supplier supplier = supplierIdentityService.requireCurrent();
        int channelLimit = 0;
        if (body.get("channelLimit") != null && !String.valueOf(body.get("channelLimit")).isBlank()) {
            try {
                channelLimit = Integer.parseInt(String.valueOf(body.get("channelLimit")).trim());
            } catch (RuntimeException e) {
                return ResponseEntity.ok(Map.of("success", false, "message", "渠道上限必须是整数"));
            }
        }
        if (channelLimit < 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "渠道上限不能为负数"));
        }
        LocalDateTime expireAt = null;
        String rawExpire = body.get("expireAt") == null ? "" : String.valueOf(body.get("expireAt")).trim();
        if (!rawExpire.isEmpty()) {
            try {
                String normalized = rawExpire.replace('T', ' ');
                if (normalized.length() == 16) normalized += ":00";
                expireAt = LocalDateTime.parse(normalized, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            } catch (RuntimeException e) {
                return ResponseEntity.ok(Map.of("success", false, "message", "过期时间格式应为 YYYY-MM-DD HH:mm:ss"));
            }
            if (expireAt.isBefore(LocalDateTime.now())) {
                return ResponseEntity.ok(Map.of("success", false, "message", "过期时间不能早于当前时间"));
            }
        }
        Long id = IdWorker.getId();
        String code = generateCode(supplier.getId());
        jdbc.update("INSERT INTO s2b2c_supplier_invite (id, supplier_id, code, channel_limit, used_count, "
                        + "expire_at, status, create_time) VALUES (?,?,?,?,0,?, 'ACTIVE', NOW())",
                id, supplier.getId(), code, channelLimit, expireAt);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "邀请码已生成");
        result.put("id", String.valueOf(id));
        result.put("code", code);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/invites/{id}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable Long id,
                                                            @RequestParam String status) {
        Supplier supplier = supplierIdentityService.requireCurrent();
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("ACTIVE", "DISABLED").contains(normalized)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 ACTIVE / DISABLED"));
        }
        int updated = jdbc.update("UPDATE s2b2c_supplier_invite SET status = ? WHERE id = ? AND supplier_id = ?",
                normalized, id, supplier.getId());
        return ResponseEntity.ok(Map.of("success", updated > 0, "message", updated > 0 ? "状态已更新" : "邀请码不存在"));
    }

    @GetMapping("/recruits")
    public ResponseEntity<List<Map<String, Object>>> recruits() {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(jdbc.queryForList(
                "SELECT r.id, r.channel_id AS channelId, c.shop_name AS channelName, r.invite_code AS inviteCode, "
                        + "r.status, r.create_time AS createTime FROM s2b2c_supplier_recruit r "
                        + "LEFT JOIN s2b2c_channel_partner c ON r.channel_id = c.id "
                        + "WHERE r.supplier_id = ? ORDER BY r.create_time DESC", supplier.getId()));
    }

    private String generateCode(Long supplierId) {
        StringBuilder suffix = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            suffix.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        String code = "SC" + String.valueOf(supplierId).substring(Math.max(0, String.valueOf(supplierId).length() - 4))
                + suffix;
        Long exists = jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_supplier_invite WHERE code = ?", Long.class, code);
        return exists != null && exists > 0 ? generateCode(supplierId) : code;
    }
}
