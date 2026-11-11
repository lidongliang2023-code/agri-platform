package com.agri.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 模型配置变更审计；只保存脱敏摘要，不保存 API Key 或配置正文。 */
@Service
public class ModelProviderChangeAudit {
    public record Entry(String time, long revision, String providerId, String action,
                        String operator, List<String> changedFields,
                        Map<String, Object> before, Map<String, Object> after) {}

    private static final int MAX_ENTRIES = 1000;
    private final ObjectMapper json;
    private final Path file;
    private final Deque<Entry> entries = new ArrayDeque<>();
    private boolean writable = true;

    public ModelProviderChangeAudit(ObjectMapper json,
            @Value("${ai.admin.provider-audit-file:${user.home}/.agri-platform/ai-models/provider-changes.jsonl}") String file) {
        this.json = json;
        this.file = Path.of(file).toAbsolutePath();
        load();
    }

    private void load() {
        if (!Files.exists(file)) return;
        try (var lines = Files.lines(file)) {
            lines.forEach(line -> {
                try {
                    Entry entry = json.readValue(line, Entry.class);
                    entries.addLast(entry);
                    if (entries.size() > MAX_ENTRIES) entries.removeFirst();
                } catch (Exception ignored) {
                    // 忽略服务异常退出留下的不完整尾行，保留其他有效记录。
                }
            });
        } catch (Exception e) {
            writable = false;
        }
    }

    public synchronized void record(long revision, String providerId, String operator,
                                    List<String> changedFields, Map<String, Object> before,
                                    Map<String, Object> after) {
        record(revision,providerId,"UPDATE_PROVIDER",operator,changedFields,before,after);
    }
    public synchronized void record(long revision, String providerId, String action, String operator,
                                    List<String> changedFields, Map<String,Object> before, Map<String,Object> after) {
        Entry entry = new Entry(Instant.now().toString(), revision, providerId, action,
                safe(operator), List.copyOf(changedFields), safeMap(before), safeMap(after));
        entries.addLast(entry);
        boolean rotate = entries.size() > MAX_ENTRIES;
        if (rotate) entries.removeFirst();
        try {
            Files.createDirectories(file.getParent());
            if (rotate) {
                StringBuilder data = new StringBuilder();
                for (Entry item : entries) data.append(json.writeValueAsString(item)).append('\n');
                Files.writeString(file, data, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            } else {
                Files.writeString(file, json.writeValueAsString(entry) + "\n",
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
            writable = true;
        } catch (Exception e) {
            writable = false;
        }
    }

    public synchronized List<Entry> list(String providerId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<Entry> result = new ArrayList<>();
        var iterator = entries.descendingIterator();
        while (iterator.hasNext() && result.size() < safeLimit) {
            Entry entry = iterator.next();
            if (providerId == null || providerId.isBlank() || providerId.equals(entry.providerId())) result.add(entry);
        }
        return result;
    }

    public synchronized boolean writable() { return writable; }

    private Map<String, Object> safeMap(Map<String, Object> value) {
        return value == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(value));
    }

    private String safe(String value) { return value == null || value.isBlank() ? "未核验操作人" : value; }
}
