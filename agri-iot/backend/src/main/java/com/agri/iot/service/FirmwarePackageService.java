package com.agri.iot.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 固件包权威台账服务。
 * 规则：
 * 1. 固件包录入必须包含规范的版本语义（vX.Y.Z 或 X.Y.Z）、适用型号、完整 SHA-256 摘要、包大小及 HTTPS 固件地址。
 * 2. 状态机严格单向流转：draft（草稿）-> stable（已发布稳定版）-> deprecated（已废弃）。
 * 3. 只有已发布的 stable 固件包才能关联进 OTA 升级任务。
 * 4. 固件包一旦发布为 stable，包下载地址、版本号、适用型号与 SHA-256 摘要不可改写；废弃后不可重新发布。
 */
@Service
public class FirmwarePackageService {
    private final JdbcTemplate jdbc;
    @org.springframework.beans.factory.annotation.Autowired
    private FirmwareStorageService storage;

    public FirmwarePackageService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private String now() {
        return LocalDateTime.now().toString();
    }

    private String sanitizeUrl(String url) {
        if (url == null || url.isBlank() || url.length() > 1000) {
            throw new IllegalArgumentException("固件下载地址必须为有效的HTTPS链接且长度不超过1000");
        }
        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("固件下载地址格式不合法");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException("固件下载地址必须为不包含用户信息与Hash片段的HTTPS安全链接");
        }
        return uri.toString();
    }

    private String sanitizeHash(String hash) {
        if (hash == null || !hash.trim().matches("^[a-fA-F0-9]{64}$")) {
            throw new IllegalArgumentException("固件包必须包含规范的64位SHA-256摘要");
        }
        return hash.trim().toLowerCase(Locale.ROOT);
    }

    private String sanitizeVersion(String version) {
        if (version == null || version.isBlank() || version.length() > 40 || !version.trim().matches("^v?[0-9]+(\\.[0-9]+){1,3}(-[a-zA-Z0-9.]+)?$")) {
            throw new IllegalArgumentException("固件版本号必须符合规范语义版本（如 1.2.0 或 v2.0.1）");
        }
        return version.trim();
    }

    @Transactional
    public Map<String, Object> register(Map<String, Object> payload) {
        String name = Objects.toString(payload.get("firmwareName"), "").trim();
        String version = sanitizeVersion(Objects.toString(payload.get("versionName"), ""));
        String type = Objects.toString(payload.get("firmwareType"), "gateway").trim().toLowerCase(Locale.ROOT);
        String model = Objects.toString(payload.get("targetModel"), "ALL").trim();
        String url = sanitizeUrl(Objects.toString(payload.get("packageUrl"), ""));
        String hash = sanitizeHash(Objects.toString(payload.get("sha256Text"), ""));
        String notes = Objects.toString(payload.get("releaseNotes"), "").trim();
        String changelog = Objects.toString(payload.get("changelogText"), "").trim();
        long size = 0L;
        try {
            size = Long.parseLong(Objects.toString(payload.get("fileSizeBytes"), "0"));
        } catch (Exception ignored) {}

        if (name.isBlank() || name.length() > 120) throw new IllegalArgumentException("固件名称不能为空且最多120字");
        if (model.isBlank() || model.length() > 80) throw new IllegalArgumentException("适用型号不能为空且最多80字");
        if (size <= 0 || size > 2L * 1024 * 1024 * 1024) throw new IllegalArgumentException("固件包大小必须大于0且不超过2GB");
        if (!"gateway".equals(type) && !"sensor".equals(type) && !"controller".equals(type)) {
            throw new IllegalArgumentException("固件类型仅支持 gateway, sensor, controller");
        }

        if(storage!=null && storage.managed(url))storage.verify(url,hash,size);
        if (notes.length()>500 || changelog.length()>1000) throw new IllegalArgumentException("发布说明最多500字，变更记录最多1000字");
        // 校验版本唯一性（同型号同类型不可重复）
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(1) FROM iot_firmware WHERE firmware_type=? AND target_model=? AND version_name=?",
            Integer.class, type, model, version
        );
        if (count != null && count > 0) {
            throw new IllegalArgumentException("该型号与类型下已存在版本为 " + version + " 的固件记录，禁止重复登记");
        }

        jdbc.update(
            "INSERT INTO iot_firmware(product_name,version_name,firmware_type,target_model,package_url,file_size_bytes,status,sha256_text,release_notes,changelog_text,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            name, version, type, model, url, size, "draft", hash, notes, changelog, now()
        );
        Long id = jdbc.queryForObject("SELECT id FROM iot_firmware WHERE firmware_type=? AND target_model=? AND version_name=?", Long.class, type, model, version);
        return Map.of("id", id, "firmwareName", name, "versionName", version, "status", "draft", "message", "固件草稿包登记成功");
    }

    @Transactional
    public Map<String, Object> publish(long id) {
        var rows = jdbc.queryForList("SELECT * FROM iot_firmware WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("固件记录不存在");
        var fw = rows.get(0);
        String status = Objects.toString(fw.get("status"), "");
        if ("stable".equals(status)) {
            return Map.of("id", id, "status", "stable", "message", "固件包已处于发布稳定态");
        }
        if (!"draft".equals(status)) {
            throw new IllegalArgumentException("仅草稿态固件包允许发布为稳定版");
        }
        String url = Objects.toString(fw.get("package_url"), "");
        String hash = Objects.toString(fw.get("sha256_text"), "");
        sanitizeUrl(url);
        sanitizeHash(hash);
        sanitizeVersion(Objects.toString(fw.get("version_name"),""));
        if (Long.parseLong(Objects.toString(fw.get("file_size_bytes"),"0"))<=0) throw new IllegalArgumentException("历史固件缺少包大小，不能发布");

        if(storage!=null && storage.managed(url))storage.verify(url,hash,Long.parseLong(fw.get("file_size_bytes").toString()));
        jdbc.update("UPDATE iot_firmware SET status='stable', published_at=? WHERE id=?", now(), id);
        return Map.of("id", id, "status", "stable", "message", "固件包已成功发布为稳定版，现可供OTA升级任务选用");
    }

    @Transactional
    public Map<String, Object> deprecate(long id, String reason) {
        var rows = jdbc.queryForList("SELECT * FROM iot_firmware WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("固件记录不存在");
        var fw = rows.get(0);
        String status = Objects.toString(fw.get("status"), "");
        if ("deprecated".equals(status)) {
            return Map.of("id", id, "status", "deprecated", "message", "固件包已处于废弃状态");
        }
        if(reason==null||reason.trim().length()<4||reason.length()>300)throw new IllegalArgumentException("请填写4至300字废弃原因");
        // 检查是否有正在执行的 OTA 任务依赖该固件
        Integer runningTasks = jdbc.queryForObject(
            "SELECT COUNT(1) FROM iot_ota_task WHERE firmware_id=? AND status='running'",
            Integer.class, id
        );
        if (runningTasks != null && runningTasks > 0) {
            throw new IllegalArgumentException("当前有正在运行的OTA升级任务正在使用该固件，禁止直接下线废弃");
        }
        jdbc.update("UPDATE iot_firmware SET status='deprecated', deprecated_at=?,deprecate_reason=? WHERE id=?", now(), reason.trim(), id);
        return Map.of("id", id, "status", "deprecated", "message", "固件包已标记为废弃，不再支持新任务选用");
    }

    public List<Map<String, Object>> list(String type, String model, String status) {
        StringBuilder sql = new StringBuilder("SELECT id, product_name AS firmwareName, version_name AS versionName, firmware_type AS firmwareType, target_model AS targetModel, package_url AS packageUrl, file_size_bytes AS fileSizeBytes, status, sha256_text AS sha256Text, release_notes AS releaseNotes, changelog_text AS changelogText, published_at AS publishedAt, deprecated_at AS deprecatedAt, COALESCE(created_at,release_at) AS createdAt,deprecate_reason AS deprecateReason FROM iot_firmware WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (type != null && !type.isBlank()) {
            sql.append(" AND firmware_type=?");
            params.add(type.trim());
        }
        if (model != null && !model.isBlank()) {
            sql.append(" AND (target_model=? OR target_model='ALL')");
            params.add(model.trim());
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND status=?");
            params.add(status.trim());
        }
        sql.append(" ORDER BY id DESC");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> get(long id) {
        var rows = jdbc.queryForList("SELECT id, product_name AS firmwareName, version_name AS versionName, firmware_type AS firmwareType, target_model AS targetModel, package_url AS packageUrl, file_size_bytes AS fileSizeBytes, status, sha256_text AS sha256Text, release_notes AS releaseNotes, changelog_text AS changelogText, published_at AS publishedAt, deprecated_at AS deprecatedAt, COALESCE(created_at,release_at) AS createdAt,deprecate_reason AS deprecateReason FROM iot_firmware WHERE id=?", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("固件不存在");
        return rows.get(0);
    }
}
