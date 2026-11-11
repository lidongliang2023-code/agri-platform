package com.agri.ai.service;
import com.agri.common.ai.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

/** 有界审计：保存元数据，不落业务输入/输出正文、令牌或密钥；轮转时仅保留最近1000条。 */
@Service
public class AiCallAudit {
    public record Entry(String time, String taskId, String sceneCode, String bizSystem, String status,
                        long latencyMs, String traceId, String source, String operator, String provider, Boolean failover, List<Map<String,Object>> modelAttempts) {}
    private final Deque<Entry> entries = new ArrayDeque<>();
    private final Path file; private final ObjectMapper json;
    private boolean writable = true;
    public AiCallAudit(ObjectMapper json, @Value("${ai.admin.audit-file:ops/local/logs/ai-admin-audit.log}") String file) {
        this.json = json; this.file = Path.of(file).toAbsolutePath();
        try {
            if (Files.exists(this.file)) {
                // 最多加载最近1000条，跳过服务异常退出时可能留下的不完整尾行。
                try (var lines = Files.lines(this.file)) { lines.forEach(line -> {
                    try { entries.addLast(json.readValue(line, Entry.class)); if (entries.size() > 1000) entries.removeFirst(); }
                    catch (Exception ignored) { }
                }); }
            }
        } catch (Exception e) { writable = false; }
    }
    public synchronized void record(AiInvokeRequest req, AiInvokeResponse result) {
        var attrs = RequestContextHolder.getRequestAttributes();
        String source = "业务调度", operator = "未核验调用方";
        if (attrs instanceof ServletRequestAttributes a && a.getRequest().getAttribute("ai.operator") != null) {
            operator = String.valueOf(a.getRequest().getAttribute("ai.operator")); source = "管理端调试";
        }
        long elapsed = result.getUsage() == null ? 0 : ((Number)result.getUsage().getOrDefault("latency_ms",0)).longValue();
        Entry entry = new Entry(Instant.now().toString(), result.getTaskId(), req.getSceneCode(), req.getBizSystem(),
                result.getStatus(), elapsed, result.getTraceId(), source, operator,
                result.getUsage()==null?null:Objects.toString(result.getUsage().get("provider"),null),
                result.getUsage()==null?false:Boolean.TRUE.equals(result.getUsage().get("failover")),
                result.getUsage()==null?List.of():(List<Map<String,Object>>)result.getUsage().getOrDefault("model_attempts",List.of()));
        entries.addLast(entry); boolean rotate = entries.size() > 1000; if (rotate) entries.removeFirst();
        try {
            Files.createDirectories(file.getParent());
            if (rotate) {
                StringBuilder data = new StringBuilder(); for (Entry e : entries) data.append(json.writeValueAsString(e)).append('\n');
                Files.writeString(file, data, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            } else Files.writeString(file, json.writeValueAsString(entry) + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            writable = true;
        } catch (Exception e) { writable = false; }
    }
    public synchronized List<Entry> list() { var result = new ArrayList<>(entries); Collections.reverse(result); return result; }
    public synchronized boolean writable() { return writable; }
}
