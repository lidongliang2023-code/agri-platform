package com.agri.satellite.gov;

import com.agri.core.infra.util.JsonUtil;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 监管数据接收与单向导出。
 * 导出协议：JSON Lines 批次文件（gov_export_yyyyMMdd.jsonl），由前置机摆渡到政务内网。
 * 生产增强点：国密 SM4 落盘加密 + 文件签名（国密改造预留）。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/gov")
@RequiredArgsConstructor
public class ExchangeController {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final JdbcTemplate jdbc;

    @Value("${agri.gov.export-dir:./gov-outbox}")
    private String exportDir;

    public record SubmitRequest(String dataType, Object payload) {
    }

    @PostMapping("/submit")
    public ApiResponse<Map<String, Object>> submit(@RequestBody SubmitRequest req) {
        if (req.dataType() == null || req.dataType().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "dataType 不能为空");
        }
        String batchNo = "GOV" + DAY.format(LocalDateTime.now()) + ThreadLocalRandom.current().nextInt(100000, 999999);
        Map<String, Object> envelope = Map.of(
                "batchNo", batchNo,
                "dataType", req.dataType(),
                "payload", req.payload() == null ? Map.of() : req.payload(),
                "receivedAt", LocalDateTime.now().toString());

        try {
            Path dir = Paths.get(exportDir);
            Files.createDirectories(dir);
            Path file = dir.resolve("gov_export_" + DAY.format(LocalDateTime.now()) + ".jsonl");
            Files.writeString(file, JsonUtil.MAPPER.writeValueAsString(envelope) + "\n",
                    StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception e) {
            log.error("监管数据导出失败: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.BIZ_ERROR, "导出失败，请检查前置机导出目录");
        }

        jdbc.update("INSERT INTO gov_submit_log (batch_no, data_type, status, created_at) VALUES (?,?, 'EXPORTED', NOW())",
                batchNo, req.dataType());
        log.info("监管数据已导出: batch={}, type={}", batchNo, req.dataType());
        return ApiResponse.ok(Map.of("batchNo", batchNo, "status", "EXPORTED"));
    }

    @GetMapping("/logs")
    public ApiResponse<java.util.List<Map<String, Object>>> logs(
            @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.ok(jdbc.queryForList(
                "SELECT batch_no, data_type, status, created_at FROM gov_submit_log ORDER BY id DESC LIMIT ?",
                limit));
    }
}
