package com.agri.ai.service;

import com.agri.ai.config.AIConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 统一真实模型调用：通义兼容 OpenAI Chat Completions 协议，或 OpenAI 官方协议。 */
@Service
public class RealModelClient {
    public record Result(Map<String, Object> output, long inputTokens, long outputTokens, String model,
                         String providerId, String providerName, List<Map<String,Object>> attempts, boolean failover) {
        public Result(Map<String,Object> output,long inputTokens,long outputTokens,String model) { this(output,inputTokens,outputTokens,model,"","",List.of(),false); }
    }
    public static class RouteFailure extends IllegalStateException {
        private final List<Map<String,Object>> attempts;
        public RouteFailure(List<Map<String,Object>> attempts) { super("模型调用失败，请查看通道尝试记录"); this.attempts=List.copyOf(attempts); }
        public List<Map<String,Object>> attempts() { return attempts; }
    }
    private static class ModelFailure extends IllegalStateException {
        final String reason; final Integer status; final boolean retryable;
        ModelFailure(String reason,Integer status,boolean retryable) { super(reason); this.reason=reason;this.status=status;this.retryable=retryable; }
    }

    private final AIConfig config;
    private final ModelProviderSettings settings;
    private final ObjectMapper json;
    private final ModelCircuitBreaker circuits;
    private final ModelFailoverStatistics statistics;

    public RealModelClient(AIConfig config, ObjectMapper json, ModelProviderSettings settings, ModelCircuitBreaker circuits, ModelFailoverStatistics statistics) {
        this.statistics=statistics;
        this.circuits=circuits;
        this.settings=settings;
        this.config = config;
        this.json = json;
    }

    public boolean configured() {
        return isConfigured(settings.selectedChannel());
    }
    public static boolean isConfigured(ModelProviderSettings.Channel c) {
        return ("NONE".equals(c.authType()) || (!c.apiKey().isBlank()&&!"your-api-key".equalsIgnoreCase(c.apiKey()))) && !c.baseUrl().isBlank()&&!c.model().isBlank();
    }
    public String provider() { return settings.selectedChannel().id(); }
    public String modelName() { return settings.selectedChannel().model(); }
    public String baseUrlForDisplay() { return settings.selectedChannel().baseUrl(); }

    public Result complete(String systemPrompt, String userPrompt) {
        return complete(settings.selectedChannel(),systemPrompt,userPrompt);
    }
    /** 单次请求使用不可变通道快照，不改动全局选择。 */
    public Result complete(ModelProviderSettings.Channel channel, String systemPrompt, String userPrompt) {
        return complete(channel,systemPrompt,userPrompt,"");
    }
    public Result complete(ModelProviderSettings.Channel channel, String systemPrompt, String userPrompt, String sceneCode) {
        if(!config.isRealInferenceEnabled()) throw new IllegalStateException("真实推理开关已关闭");
        var route=settings.route(channel); var attempts=new java.util.ArrayList<Map<String,Object>>();
        long started=System.nanoTime();
        long deadline=started+45_000_000_000L;
        for(var target:route.channels()) {
            long remaining=(deadline-System.nanoTime())/1000000;
            if(route.channels().size()>1 && remaining<2) break;
            int attemptTimeout=route.channels().size()>1?(int)Math.min(route.timeoutMs(),remaining/2):route.timeoutMs();
            long start=System.nanoTime(); var entry=new LinkedHashMap<String,Object>();
            entry.put("provider",target.id()); entry.put("provider_name",target.name()); entry.put("model",target.model());
            var ticket=circuits.acquire(target,settings.circuitPolicy(target.id()));
            entry.put("circuit_state",ticket.state());
            if(!ticket.allowed()) {
                entry.put("status","SKIPPED");entry.put("reason",ticket.reason());entry.put("latency_ms",0);
                attempts.add(entry);continue;
            }
            try {
                if(!isConfigured(target)) throw new ModelFailure("配置不完整",null,true);
                var result=attempt(target,systemPrompt,userPrompt,attemptTimeout);
                circuits.success(ticket);
                entry.put("status","SUCCESS"); entry.put("latency_ms",(System.nanoTime()-start)/1000000);attempts.add(entry);
                statistics.record(channel,sceneCode,route.channels().size()>1,attempts,true,(System.nanoTime()-started)/1000000);
                return new Result(result.output(),result.inputTokens(),result.outputTokens(),result.model(),target.id(),target.name(),List.copyOf(attempts),attempts.size()>1);
            } catch(ModelFailure e) {
                circuits.failure(ticket,e.retryable,e.reason);
                entry.put("status","FAILED");entry.put("reason",e.reason); if(e.status!=null)entry.put("http_status",e.status);
                entry.put("latency_ms",(System.nanoTime()-start)/1000000); attempts.add(entry);
                if(!e.retryable) break;
            }
        }
        statistics.record(channel,sceneCode,route.channels().size()>1,attempts,false,(System.nanoTime()-started)/1000000);
        throw new RouteFailure(attempts);
    }
    private Result attempt(ModelProviderSettings.Channel channel,String systemPrompt,String userPrompt,int timeoutMs) {
        var factory=new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Math.max(1,Math.min(config.getConnectTimeoutMs(),timeoutMs)));
        factory.setReadTimeout(timeoutMs);
        var client=new RestTemplate(factory);
        String requestKey=channel.apiKey(), requestUrl=channel.baseUrl(), requestModel=channel.model();
        if(!"NONE".equals(channel.authType())&&(requestKey.isBlank()||"your-api-key".equalsIgnoreCase(requestKey))) throw new IllegalStateException("真实模型通道未配置 API Key");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", requestModel);
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt + "\n\n请仅返回一个合法 JSON 对象，不要使用 Markdown 代码块。")));
        body.put("temperature", 0.2);
        body.put("max_tokens", 2048);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if(!"NONE".equals(channel.authType())) headers.setBearerAuth(requestKey);
        try {
            String raw = client.postForObject(requestUrl.replaceAll("/+$", "") + "/chat/completions", new HttpEntity<>(body, headers), String.class);
            return parse(raw,requestModel);
        } catch (RestClientResponseException e) {
            int status=e.getStatusCode().value();
            throw new ModelFailure("上游 HTTP "+status,status,status==401||status==403||status==404||status==408||status==429||status>=500);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            throw new ModelFailure("网络连接失败或请求超时",null,true);
        } catch (Exception e) {
            throw new ModelFailure("模型响应格式异常或内容为空",null,true);
        }
    }

    private Result parse(String raw, String requestModel) {
        try {
            JsonNode root = json.readTree(raw);
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) throw new IllegalStateException("模型返回缺少 choices");
            JsonNode content = choices.get(0).path("message").path("content");
            if (!content.isTextual() || content.asText().isBlank()) throw new IllegalStateException("模型返回内容为空");
            String text = stripMarkdown(content.asText().trim());
            Map<String, Object> output;
            try {
                JsonNode parsed = json.readTree(text);
                if (!parsed.isObject()) throw new IllegalArgumentException();
                output = json.convertValue(parsed, Map.class);
            } catch (Exception ignored) {
                output = new LinkedHashMap<>();
                output.put("answer", content.asText().trim());
                output.put("structured", false);
            }
            long input = root.path("usage").path("prompt_tokens").asLong(0);
            long outputTokens = root.path("usage").path("completion_tokens").asLong(0);
            return new Result(output, input, outputTokens, root.path("model").asText(requestModel));
        } catch (Exception e) {
            if (e instanceof IllegalStateException state) throw state;
            throw new IllegalStateException("模型返回格式无法解析", e);
        }
    }

    private String stripMarkdown(String text) {
        if (text.startsWith("```")) {
            int first = text.indexOf('\n');
            int last = text.lastIndexOf("```");
            if (first >= 0 && last > first) return text.substring(first + 1, last).trim();
        }
        return text;
    }

}
