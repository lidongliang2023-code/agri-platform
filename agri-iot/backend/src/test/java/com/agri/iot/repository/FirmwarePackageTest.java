package com.agri.iot.repository;

import com.agri.iot.service.FirmwarePackageService;
import com.agri.iot.service.FirmwareStorageService;
import com.agri.iot.controller.FirmwareDownloadController;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import java.io.File;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class FirmwarePackageTest {
    JdbcTemplate jdbc;
    FirmwarePackageService firmwareService;
    FirmwareStorageService storageService;
    Path tempDir;

    @BeforeEach
    void setup() throws Exception {
        tempDir = Files.createTempDirectory("fw-test-");
        jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE TABLE iot_firmware(id BIGINT AUTO_INCREMENT PRIMARY KEY, product_name VARCHAR(120), version_name VARCHAR(40), firmware_type VARCHAR(40), target_model VARCHAR(80), package_url VARCHAR(1000), file_size_bytes BIGINT, status VARCHAR(20), sha256_text VARCHAR(64), release_notes VARCHAR(500), changelog_text VARCHAR(1000), created_at VARCHAR(40), published_at VARCHAR(40), deprecated_at VARCHAR(40), release_at VARCHAR(40), deprecate_reason VARCHAR(300))");
        jdbc.execute("CREATE TABLE iot_ota_task(id BIGINT PRIMARY KEY, firmware_id BIGINT, status VARCHAR(20))");
        jdbc.execute("CREATE TABLE iot_ota_receipt(id BIGINT AUTO_INCREMENT PRIMARY KEY, task_id BIGINT, gateway_id BIGINT, firmware_url VARCHAR(1000), sha256_text VARCHAR(64), command_status VARCHAR(20), expires_at VARCHAR(40))");

        storageService = new FirmwareStorageService(tempDir.toString(), "https://iot.agri.local/api/v1/iot/gateway-channel/firmware", 10 * 1024 * 1024);
        firmwareService = new FirmwarePackageService(jdbc);
        ReflectionTestUtils.setField(firmwareService, "storage", storageService);
    }

    @AfterEach
    void cleanup() {
        if (tempDir != null) {
            try {
                Files.walk(tempDir).sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
            } catch (Exception ignored) {}
        }
    }

    Map<String, Object> sampleDraft(String version) {
        return Map.of(
            "firmwareName", "EdgeGateway 稳定升级包",
            "versionName", version,
            "firmwareType", "gateway",
            "targetModel", "GW-PRO-2026",
            "packageUrl", "https://download.agri.local/firmware/gw-" + version + ".bin",
            "fileSizeBytes", 15728640L,
            "sha256Text", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "releaseNotes", "优化稳定性",
            "changelogText", "修复断网重连内存泄露"
        );
    }

    @Test
    void registerAndPublishLifecycle() {
        var res = firmwareService.register(sampleDraft("v1.2.0"));
        long id = Long.parseLong(res.get("id").toString());
        assertEquals("draft", firmwareService.get(id).get("status"));

        var pub = firmwareService.publish(id);
        assertEquals("stable", pub.get("status"));
        assertEquals("stable", firmwareService.get(id).get("status"));
    }

    @Test
    void duplicateVersionOrModelRejected() {
        firmwareService.register(sampleDraft("1.0.0"));
        assertThrows(IllegalArgumentException.class, () -> firmwareService.register(sampleDraft("1.0.0")));
    }

    @Test
    void deprecateProtection() {
        var res = firmwareService.register(sampleDraft("2.0.0"));
        long id = Long.parseLong(res.get("id").toString());
        firmwareService.publish(id);

        jdbc.update("INSERT INTO iot_ota_task VALUES(100, ?, 'running')", id);
        assertThrows(IllegalArgumentException.class, () -> firmwareService.deprecate(id, "紧急下线"));

        jdbc.update("UPDATE iot_ota_task SET status='completed' WHERE id=100");
        var dep = firmwareService.deprecate(id, "硬件缺陷全面召回");
        assertEquals("deprecated", dep.get("status"));
    }

    @Test
    void uploadComputesHashAndBlocksMismatchOrTraversal() throws Exception {
        byte[] payload = "FIRMWARE-IMAGE-2026".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "gateway-v1.bin", "application/octet-stream", payload);
        var uploaded = storageService.upload(file, null);

        String hash = uploaded.get("sha256Text").toString();
        assertEquals(payload.length, Long.parseLong(uploaded.get("fileSizeBytes").toString()));
        assertEquals(64, hash.length());
        assertTrue(storageService.managed(uploaded.get("packageUrl").toString()));

        // 预期摘要不一致拦截
        assertThrows(IllegalArgumentException.class, () -> storageService.upload(file, "0000000000000000000000000000000000000000000000000000000000000000"));

        // 非法后缀与路径穿透拦截
        MockMultipartFile badName = new MockMultipartFile("file", "../payload.sh", "text/plain", payload);
        assertThrows(IllegalArgumentException.class, () -> storageService.upload(badName, null));
    }

    @Test
    void managedUploadIntegratesWithRegisterAndPublish() throws Exception {
        byte[] payload = "GATEWAY-IMAGE-PRO".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "image.bin", "application/octet-stream", payload);
        var uploaded = storageService.upload(file, null);

        var draft = new HashMap<String, Object>(sampleDraft("v3.1.0"));
        draft.put("packageUrl", uploaded.get("packageUrl"));
        draft.put("sha256Text", uploaded.get("sha256Text"));
        draft.put("fileSizeBytes", uploaded.get("fileSizeBytes"));

        var res = firmwareService.register(draft);
        long id = Long.parseLong(res.get("id").toString());

        // 若篡改托管文件，发布时将被拦截
        Path bin = tempDir.resolve(uploaded.get("sha256Text") + ".pkg");
        Files.writeString(bin, "TAMPERED-FIRMWARE");
        assertThrows(IllegalArgumentException.class, () -> firmwareService.publish(id));

        // 恢复正确内容后允许发布
        Files.write(bin, payload);
        assertEquals("stable", firmwareService.publish(id).get("status"));
    }

    @Test
    void downloadRequiresValidGatewayKeyAndActiveReceipt() throws Exception {
        byte[] payload = "DOWNLOADABLE-IMAGE".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "gw.bin", "application/octet-stream", payload);
        var uploaded = storageService.upload(file, null);
        String hash = uploaded.get("sha256Text").toString();
        String url = uploaded.get("packageUrl").toString();

        jdbc.update("INSERT INTO iot_firmware(id,file_size_bytes,sha256_text,package_url) VALUES(99,?,?,?)", payload.length, hash, url);
        jdbc.update("INSERT INTO iot_ota_task VALUES(1,99,'running')");
        jdbc.update("INSERT INTO iot_ota_receipt(task_id,gateway_id,firmware_url,sha256_text,command_status,expires_at) VALUES(1,7,?,?, 'SENT', '2099-01-01T00:00:00')", url, hash);

        String json = "{\"7\":\"01234567890123456789012345678901\"}";
        var controller = new FirmwareDownloadController(storageService, jdbc, json, new ObjectMapper());

        // 无凭据或凭据错误拦截
        assertThrows(ResponseStatusException.class, () -> controller.download(hash, 7L, null));
        assertThrows(ResponseStatusException.class, () -> controller.download(hash, 7L, "wrong-key"));

        // 未关联升级任务的其他网关拦截
        assertThrows(ResponseStatusException.class, () -> controller.download(hash, 8L, "01234567890123456789012345678901"));

        // 凭据正确且拥有已领取指令时允许下载
        var entity = controller.download(hash, 7L, "01234567890123456789012345678901");
        assertNotNull(entity.getBody());
        assertEquals(payload.length, entity.getHeaders().getContentLength());
    }
}
