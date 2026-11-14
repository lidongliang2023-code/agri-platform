package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/** 农业农村部登记清单同步：原始事实留痕，规则只进入草稿，不绕过人工审核。 */
@Service
public class InputRegistrationSyncService {
    private final JdbcTemplate db;
    private final RestTemplate http = new RestTemplate();
    private final String defaultUrl;
    private final int maxBytes;

    public InputRegistrationSyncService(JdbcTemplate db,
            @Value("${agri.input-registration-sync.default-url:https://zzys.moa.gov.cn/gzdt/202506/P020250605415301749040.xls}") String defaultUrl,
            @Value("${agri.input-registration-sync.max-bytes:52428800}") int maxBytes) {
        this.db = db; this.defaultUrl = defaultUrl; this.maxBytes = maxBytes;
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(10000); f.setReadTimeout(30000); http.setRequestFactory(f);
    }

    @Transactional
    public Map<String, Object> sync(String tenant, String requestedUrl, String operator) {
        String url = requestedUrl == null || requestedUrl.isBlank() ? defaultUrl : requestedUrl.trim();
        checkOfficial(url); String batchId = UUID.randomUUID().toString(); LocalDateTime started = LocalDateTime.now();
        byte[] bytes; String checksum;
        try {
            bytes = http.getForObject(url, byte[].class);
            if (bytes == null || bytes.length == 0) throw new IllegalStateException("官方文件为空");
            if (bytes.length > maxBytes) throw new IllegalStateException("官方文件超过大小限制");
            checksum = sha256(bytes);
        } catch (Exception e) {
            insertFailed(tenant, batchId, url, started, operator, "下载失败：" + safe(e.getMessage()));
            throw new BusinessException(502, "登记数据同步失败：官方文件暂时无法下载");
        }
        Integer old = db.queryForObject("SELECT COUNT(*) FROM agri_prod_input_registration_sync_batch WHERE tenant_id=? AND source_checksum=?", Integer.class, tenant, checksum);
        if (old != null && old > 0) return latestByChecksum(tenant, checksum);
        db.update("INSERT INTO agri_prod_input_registration_sync_batch(id,tenant_id,source_name,source_url,source_checksum,status,started_at,created_by) VALUES(?,?,?,?,?,?,?,?)", batchId, tenant, "农业农村部农药登记信息", url, checksum, "RUNNING", started, operator);
        try {
            List<Map<String, String>> rows = parseXls(bytes); int imported = 0, skipped = 0, parsed = 0;
            for (Map<String, String> row : rows) {
                String reg = value(row, "农药登记证号", "登记证号"), name = text(row, "农药名称");
                if (reg.isBlank() || name.isBlank()) { skipped++; continue; }
                parsed++; String crop = text(row, "作物/场所"), target = text(row, "防治对象");
                boolean needsLabel = crop.isBlank() || target.isBlank(); String status = needsLabel ? "NEEDS_LABEL" : "PARSED";
                String msg = needsLabel ? "官方登记清单未提供完整作物/靶标标签，需补充核验" : "登记清单已解析，剂量和安全间隔仍需按核准标签补充";
                db.update("INSERT IGNORE INTO agri_prod_input_registration_raw(batch_id,tenant_id,registration_no,holder_name,input_name,formulation,toxicity,ingredients,category,crop_name,target_name,standard_no,source_json,parse_status,parse_message,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", batchId, tenant, reg, text(row, "登记证持有人"), name, text(row, "剂型"), text(row, "毒性"), text(row, "有效成分及含量"), text(row, "农药类别"), crop, target, text(row, "产品质量标准号"), json(row), status, msg, LocalDateTime.now());
                Long rawId = db.queryForObject("SELECT id FROM agri_prod_input_registration_raw WHERE batch_id=? AND registration_no=? AND input_name=? AND IFNULL(crop_name,'')=IFNULL(?, '') AND IFNULL(target_name,'')=IFNULL(?, '') LIMIT 1", Long.class, batchId, reg, name, crop, target);
                Long inputId = findInput(tenant, reg, name);
                if (inputId == null || needsLabel) {
                    db.update("INSERT INTO agri_prod_input_registration_apply_log(tenant_id,batch_id,raw_id,action,reason,operator,created_at) VALUES(?,?,?,?,?,?,?)", tenant, batchId, rawId, "NEEDS_REVIEW", inputId == null ? "未匹配主体投入品档案" : msg, operator, LocalDateTime.now()); skipped++; continue;
                }
                String version = "MOA-" + batchId;
                String evidence = "{\"region\":\"全国\",\"sourceVersion\":\"" + version + "\",\"verifiedOn\":\"" + LocalDate.now() + "\",\"validFrom\":\"" + LocalDate.now() + "\",\"validUntil\":\"2099-12-31\",\"ingredients\":\"" + esc(text(row, "有效成分及含量")) + "\"}";
                int n = db.update("INSERT IGNORE INTO agri_prod_input_safety_rule(tenant_id,input_id,input_name,crop_name,target_name,registration_no,source,source_version,status,created_by,evidence_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", tenant, inputId, name, crop, target, reg, url, version, "DRAFT", operator, evidence, LocalDateTime.now(), LocalDateTime.now());
                Long ruleId = db.queryForObject("SELECT id FROM agri_prod_input_safety_rule WHERE tenant_id=? AND input_id=? AND crop_name=? AND target_name=? AND source_version=? LIMIT 1", Long.class, tenant, inputId, crop, target, version);
                db.update("INSERT INTO agri_prod_input_registration_apply_log(tenant_id,batch_id,raw_id,rule_id,action,reason,operator,created_at) VALUES(?,?,?,?,?,?,?,?)", tenant, batchId, rawId, ruleId, n > 0 ? "CREATED" : "SKIPPED", n > 0 ? "已生成登记规则草稿，待补全标签" : "同批次规则已存在", operator, LocalDateTime.now()); imported += n;
            }
            db.update("UPDATE agri_prod_input_registration_sync_batch SET status='SUCCEEDED',total_rows=?,parsed_rows=?,imported_rows=?,skipped_rows=?,finished_at=? WHERE tenant_id=? AND id=?", rows.size(), parsed, imported, skipped, LocalDateTime.now(), tenant, batchId);
            return batch(tenant, batchId);
        } catch (Exception e) {
            db.update("UPDATE agri_prod_input_registration_sync_batch SET status='FAILED',error_message=?,finished_at=? WHERE tenant_id=? AND id=?", "解析或入库失败：" + safe(e.getMessage()), LocalDateTime.now(), tenant, batchId);
            throw new BusinessException(422, "登记文件解析失败，批次已留痕");
        }
    }

    public List<Map<String, Object>> batches(String tenant) { return db.queryForList("SELECT * FROM agri_prod_input_registration_sync_batch WHERE tenant_id=? ORDER BY started_at DESC LIMIT 30", tenant); }
    public Map<String, Object> config() { return Map.of("defaultUrl", defaultUrl, "sourceName", "农业农村部农药登记信息", "autoEnable", false, "note", "官方清单同步后只生成草稿；剂量、安全间隔和有效标签需人工补全审核"); }

    private List<Map<String, String>> parseXls(byte[] bytes) throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheetAt(0); int header = -1; Map<String, Integer> cols = new HashMap<>();
            for (int i = 0; i <= Math.min(sheet.getLastRowNum(), 40); i++) { Row r = sheet.getRow(i); if (r == null) continue; for (Cell c : r) if (cell(c).contains("登记证号")) { header = i; break; } if (header >= 0) { for (Cell c : r) cols.put(cell(c), c.getColumnIndex()); break; } }
            if (header < 0 || (!cols.containsKey("登记证号") && !cols.containsKey("农药登记证号"))) throw new IllegalArgumentException("未找到登记证号表头");
            List<Map<String, String>> out = new ArrayList<>();
            for (int i = header + 1; i <= sheet.getLastRowNum(); i++) { Row r = sheet.getRow(i); if (r == null) continue; Map<String, String> one = new LinkedHashMap<>(); for (var e : cols.entrySet()) one.put(e.getKey(), cell(r.getCell(e.getValue(), Row.MissingCellPolicy.RETURN_BLANK_AS_NULL))); if (!value(one, "农药登记证号", "登记证号").isBlank()) out.add(one); }
            return out;
        }
    }
    private Long findInput(String tenant, String reg, String name) { List<Map<String, Object>> r = db.queryForList("SELECT id FROM agri_prod_input_material WHERE tenant_id=? AND deleted=0 AND status=1 AND (registration_no=? OR material_name=?) LIMIT 1", tenant, reg, name); return r.isEmpty() ? null : ((Number) r.get(0).get("id")).longValue(); }
    private Map<String, Object> batch(String tenant, String id) { List<Map<String, Object>> r = db.queryForList("SELECT * FROM agri_prod_input_registration_sync_batch WHERE tenant_id=? AND id=?", tenant, id); if (r.isEmpty()) throw new BusinessException(404, "同步批次不存在"); return r.get(0); }
    private Map<String, Object> latestByChecksum(String tenant, String checksum) { return db.queryForList("SELECT * FROM agri_prod_input_registration_sync_batch WHERE tenant_id=? AND source_checksum=? ORDER BY started_at DESC LIMIT 1", tenant, checksum).get(0); }
    private void insertFailed(String tenant, String id, String url, LocalDateTime at, String by, String error) { db.update("INSERT INTO agri_prod_input_registration_sync_batch(id,tenant_id,source_name,source_url,source_checksum,status,error_message,started_at,finished_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)", id, tenant, "农业农村部农药登记信息", url, "FAILED-" + id, "FAILED", error, at, LocalDateTime.now(), by); }
    private void checkOfficial(String url) { try { String h = java.net.URI.create(url).getHost(); if (h == null || !(h.equals("moa.gov.cn") || h.endsWith(".moa.gov.cn"))) throw new BusinessException(400, "登记同步仅允许农业农村部官方来源"); } catch (IllegalArgumentException e) { throw new BusinessException(400, "官方登记数据地址格式不正确"); } }
    private static String text(Map<String, String> r, String k) { return r.getOrDefault(k, "").replace('\u00a0', ' ').trim(); }
    private static String value(Map<String, String> r, String... keys) { for (String k : keys) { String v = text(r, k); if (!v.isBlank()) return v; } return ""; }
    private static String cell(Cell c) { if (c == null) return ""; c.setCellType(CellType.STRING); return c.getStringCellValue().trim(); }
    private static String sha256(byte[] b) throws Exception { byte[] d = MessageDigest.getInstance("SHA-256").digest(b); StringBuilder s = new StringBuilder(); for (byte x : d) s.append(String.format("%02x", x)); return s.toString(); }
    private static String json(Map<String, String> m) { return "{\"registrationNo\":\"" + esc(value(m, "农药登记证号", "登记证号")) + "\",\"inputName\":\"" + esc(m.get("农药名称")) + "\",\"cropName\":\"" + esc(m.get("作物/场所")) + "\",\"targetName\":\"" + esc(m.get("防治对象")) + "\"}"; }
    private static String esc(String s) { return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", " ").replace("\n", " "); }
    private static String safe(String s) { if (s == null) return "未知错误"; s = s.replaceAll("[\\p{Cntrl}]", " "); return s.substring(0, Math.min(500, s.length())); }
}
