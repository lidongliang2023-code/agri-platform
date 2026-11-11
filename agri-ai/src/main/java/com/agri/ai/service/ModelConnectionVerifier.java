package com.agri.ai.service;

import com.agri.ai.config.AIConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** 独立通道探测，不切换当前通道，不走规则降级，不暴露上游响应或凭据。 */
@Service
public class ModelConnectionVerifier {
    public record TestResult(boolean ok, String status, String message, String testedAt,
                             long latencyMs, Integer httpStatus, Long inputTokens, Long outputTokens) {}
    private record Channel(String key, String baseUrl, String model, boolean requireKey) {}
    private final AiSceneManagement management;
    private final AIConfig config;
    private final ObjectMapper json;
    private final ModelProviderSettings settings;
    private final ModelProviderChangeAudit changeAudit;
    private final RestTemplate rest;
    private final ModelCircuitBreaker circuits;
    private final Map<String, TestResult> results = new ConcurrentHashMap<>();
    private final Set<String> running = ConcurrentHashMap.newKeySet();
    private final Map<String, Long> lastStarted = new HashMap<>();

    public ModelConnectionVerifier(AIConfig config, ObjectMapper json, ModelProviderSettings settings,
                                   ModelProviderChangeAudit changeAudit, AiSceneManagement management, ModelCircuitBreaker circuits) {
        this.circuits=circuits;
        this.management=management;
        this.config = config;
        this.settings = settings;
        this.changeAudit = changeAudit;
        this.json = json;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Math.max(1, Math.min(config.getConnectTimeoutMs(), 3000)));
        factory.setReadTimeout(Math.max(1, Math.min(config.getRequestTimeoutMs(), 10000)));
        this.rest = new RestTemplate(factory);
    }

    public synchronized Map<String, Object> describe(String id, String name) {
        Channel channel = channel(id);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", id);
        data.put("name", name);
        data.put("selected", id.equalsIgnoreCase(config.getProvider()));
        data.put("configured", missing(channel).isEmpty());
        data.put("model", channel.model());
        data.put("missingFields", missing(channel));
        data.put("inferenceEnabled", config.isRealInferenceEnabled());
        data.put("testing", running.contains(id));
        data.put("lastTest", results.get(id));
        data.put("connectionTested", results.containsKey(id));
        data.putAll(settings.describe(id));
        data.put("circuitStatus",circuits.status(settings.channel(id),settings.circuitPolicy(id)));
        return data;
    }

    public synchronized List<Map<String,Object>> providers() {
        return settings.ids().stream().map(id -> describe(id,settings.channel(id).name())).toList();
    }
    private void idle() {
        if(!running.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"通道正在验证，请等待验证完成后修改配置");
    }
    public synchronized Map<String,Object> create(ModelProviderSettings.Edit edit, String operator) {
        idle(); var change=settings.create(edit,operator); String id=String.valueOf(change.after().get("id"));
        changeAudit.record(change.revision(),id,"CREATE_PROVIDER",operator,changedFields(change.before(),change.after()),change.before(),change.after());
        results.clear(); lastStarted.clear(); return describe(id,settings.channel(id).name());
    }
    public synchronized void delete(String id, long revision, String operator) {
        idle(); ModelProviderSettings.Change change;
        synchronized(management) {
            var references=management.modelReferences(id);
            if(!references.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,
                    "该通道被场景使用，请先解除场景绑定："+String.join("、",references));
            change=settings.delete(id,revision,operator);
        }
        changeAudit.record(change.revision(),id,"DELETE_PROVIDER",operator,new ArrayList<>(change.before().keySet()),change.before(),change.after());
        circuits.forget(id); results.clear(); lastStarted.clear();
    }
    public synchronized Map<String,Object> saveCircuit(String id, ModelProviderSettings.CircuitEdit edit, String operator) {
        idle(); var change=settings.saveCircuit(id,edit,operator);
        if(!Objects.equals(change.get("before"),change.get("after"))) {
            circuits.forget(id);
            changeAudit.record(((Number)change.get("revision")).longValue(),id,"UPDATE_CIRCUIT",operator,
                List.of("circuit"),(Map<String,Object>)change.get("before"),(Map<String,Object>)change.get("after"));
        }
        return describe(id,settings.channel(id).name());
    }
    public synchronized Map<String,Object> requestCircuitProbe(String id, Long revision, String operator) {
        if(revision==null || revision.longValue()!=((Number)settings.describe(id).get("revision")).longValue())
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"配置已更新，请刷新后重试");
        var channel=settings.channel(id);var policy=settings.circuitPolicy(id);
        var before=circuits.status(channel,policy);
        circuits.requestProbe(channel,policy);
        var after=circuits.status(channel,policy);
        changeAudit.record(revision,id,"PROBE_CIRCUIT",operator,List.of("circuitState"),Map.of("circuitState",before.get("state")),Map.of("circuitState",after.get("state")));
        return describe(id,channel.name());
    }
    public synchronized Map<String,Object> saveFailover(String id, ModelProviderSettings.FailoverEdit edit, String operator) {
        idle(); var change=settings.saveFailover(id,edit,operator);
        if(!Objects.equals(change.get("before"),change.get("after")))
            changeAudit.record(((Number)change.get("revision")).longValue(),id,"UPDATE_FAILOVER",operator,
                List.of("failover"),(Map<String,Object>)change.get("before"),(Map<String,Object>)change.get("after"));
        return describe(id,settings.channel(id).name());
    }
    public synchronized Map<String,Object> switchTo(String id, Long revision, String operator) {
        if(revision==null || revision<0) throw new IllegalArgumentException("请提供有效的配置修订号");
        idle();
        var change=settings.switchTo(id,revision,operator);
        String previous=String.valueOf(change.before().get("id"));
        if(!previous.equals(id)) {
            var fields=changedFields(change.before(),change.after()); fields.add(0,"id");
            for(String related:List.of(previous,id))
                changeAudit.record(change.revision(),related,"SWITCH_PROVIDER",operator,fields,change.before(),change.after());
        }
        return describe(id,settings.channel(id).name());
    }
    public synchronized Map<String,Object> save(String id, ModelProviderSettings.Edit edit, String operator) {
        if(!running.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"通道正在验证，请等待验证完成后保存配置");
        ModelProviderSettings.Change change = settings.save(id,edit,operator);
        circuits.forget(id);
        changeAudit.record(change.revision(), id, operator, changedFields(change.before(), change.after()), change.before(), change.after());
        results.clear(); lastStarted.clear();
        return describe(id,settings.channel(id).name());
    }

    public List<ModelProviderChangeAudit.Entry> changes(String id, int limit) {
        if (!"tongyi".equals(id) && !"openai".equals(id) && !id.matches("custom-[a-f0-9-]{36}")) throw new IllegalArgumentException("不支持的模型通道");
        return changeAudit.list(id, limit);
    }

    public boolean changeAuditWritable() { return changeAudit.writable(); }

    private List<String> changedFields(Map<String,Object> before, Map<String,Object> after) {
        List<String> fields = new ArrayList<>();
        for (String key : List.of("name", "baseUrl", "model", "authType", "keyConfigured", "selected", "inferenceEnabled", "fallbackToRuleTemplate")) {
            if (!Objects.equals(before.get(key), after.get(key))) fields.add(key);
        }
        return fields;
    }

    public TestResult test(String id) {
        Channel channel;
        synchronized (this) {
            channel = channel(id);
            if (running.contains(id)) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT, "该通道正在验证，请稍候刷新结果");
            long now = System.nanoTime();
            Long previous = lastStarted.get(id);
            if (previous != null && now - previous < 10_000_000_000L)
                throw new org.springframework.web.server.ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "验证较频繁，请间隔 10 秒重试");
            lastStarted.put(id, now);
            running.add(id);
        }
        long start = System.nanoTime();
        try {
            TestResult result = probe(channel, start);
            results.put(id, result);
            return result;
        } finally {
            running.remove(id);
        }
    }

    private TestResult probe(Channel channel, long start) {
        List<String> missing = missing(channel);
        if (!missing.isEmpty()) return result(false, "NOT_CONFIGURED", "请先点击配置通道填写：" + String.join("、", missing), start, null, null);
        URI endpoint;
        try {
            endpoint = URI.create(channel.baseUrl().replaceAll("/+$", "") + "/chat/completions");
            if (!("https".equalsIgnoreCase(endpoint.getScheme()) || "http".equalsIgnoreCase(endpoint.getScheme()))
                    || endpoint.getHost() == null || endpoint.getUserInfo() != null || endpoint.getQuery() != null || endpoint.getFragment() != null)
                throw new IllegalArgumentException();
        } catch (Exception ignored) {
            return result(false, "INVALID_CONFIG", "服务地址格式不正确，请检查部署环境中的 Base URL", start, null, null);
        }
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if(channel.requireKey()) headers.setBearerAuth(channel.key());
        // 为推理型模型预留生成正文的额度，仍仅请求固定的最短回复。
        var body = Map.of("model", channel.model(), "messages", List.of(Map.of("role", "user", "content", "Reply with OK only.")), "max_tokens", 256, "stream", false);
        try {
            ResponseEntity<String> response = rest.postForEntity(endpoint, new HttpEntity<>(body, headers), String.class);
            JsonNode root;
            try { root = json.readTree(Objects.toString(response.getBody(), "")); }
            catch (Exception ignored) { return result(false, "INVALID_RESPONSE", "服务已响应，但不是有效的模型 JSON 响应，请检查接口适配", start, response.getStatusCode().value(), null); }
            JsonNode content = root == null ? null : root.path("choices").path(0).path("message").path("content");
            if (content == null || !content.isTextual() || content.asText().isBlank())
                return result(false, "INVALID_RESPONSE", "服务已响应，但未返回有效的模型回复，请检查模型名及接口适配", start, response.getStatusCode().value(), null);
            return result(true, "SUCCESS", "鉴权通过，模型已返回有效回复；业务场景效果仍需在调试工作台验证", start, response.getStatusCode().value(), root.path("usage"));
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String code, message;
            if (status == 401 || status == 403) { code = "AUTH_FAILED"; message = "鉴权失败，请检查 API Key、模型访问权限或 IP 白名单"; }
            else if (status == 429) { code = "RATE_LIMITED"; message = "服务限流或额度不足，请检查通道配额后重试"; }
            else if (status == 404) { code = "NOT_FOUND"; message = "接口或模型不存在，请检查 Base URL 和模型名称"; }
            else if (status >= 500) { code = "UPSTREAM_ERROR"; message = "模型服务暂时异常，请稍后重试"; }
            else { code = "REQUEST_REJECTED"; message = "模型服务拒绝测试请求，请检查模型名称及 Chat Completions 接口兼容性"; }
            return result(false, code, message, start, status, null);
        } catch (ResourceAccessException e) {
            boolean timeout = false;
            for (Throwable cause = e; cause != null; cause = cause.getCause())
                if (cause instanceof java.net.SocketTimeoutException || cause instanceof java.net.http.HttpTimeoutException) timeout = true;
            return result(false, timeout ? "TIMEOUT" : "NETWORK_ERROR", timeout ? "连接或响应超时，请检查模型服务可用性后重试" : "网络连接失败，请检查服务地址、DNS、证书或网络连通性", start, null, null);
        } catch (Exception ignored) {
            return result(false, "CONNECTION_FAILED", "验证失败，请检查服务配置或稍后重试", start, null, null);
        }
    }

    private TestResult result(boolean ok, String status, String message, long start, Integer httpStatus, JsonNode usage) {
        return new TestResult(ok, status, message, Instant.now().toString(), (System.nanoTime() - start) / 1_000_000,
                httpStatus, tokens(usage, "prompt_tokens"), tokens(usage, "completion_tokens"));
    }
    private Long tokens(JsonNode usage, String field) {
        JsonNode node = usage == null ? null : usage.get(field);
        return node != null && node.isIntegralNumber() && node.canConvertToLong() && node.asLong() >= 0 ? node.asLong() : null;
    }
    private List<String> missing(Channel channel) {
        List<String> fields = new ArrayList<>();
        if (channel.requireKey() && (channel.key().isBlank() || "your-api-key".equalsIgnoreCase(channel.key()))) fields.add("API Key");
        if (channel.baseUrl().isBlank()) fields.add("Base URL");
        if (channel.model().isBlank()) fields.add("模型名称");
        return fields;
    }
    private Channel channel(String id) {
        var c=settings.channel(id);
        return new Channel(c.apiKey(),c.baseUrl(),c.model(),!"NONE".equals(c.authType()));
    }
    private String value(String value) { return value == null ? "" : value.trim(); }
}
