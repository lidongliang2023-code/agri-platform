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
    public record Result(Map<String, Object> output, long inputTokens, long outputTokens, String model) {}

    private final AIConfig config;
    private final ObjectMapper json;
    private final RestTemplate rest;

    public RealModelClient(AIConfig config, ObjectMapper json) {
        this.config = config;
        this.json = json;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(config.getConnectTimeoutMs());
        factory.setReadTimeout(config.getRequestTimeoutMs());
        this.rest = new RestTemplate(factory);
    }

    public boolean configured() {
        return !apiKey().isBlank() && !"your-api-key".equalsIgnoreCase(apiKey())
                && !baseUrl().isBlank() && !model().isBlank();
    }

    public String provider() { return config.getProvider(); }
    public String modelName() { return model(); }
    public String baseUrlForDisplay() { return baseUrl(); }

    public Result complete(String systemPrompt, String userPrompt) {
        if (!configured()) throw new IllegalStateException("真实模型通道未配置 API Key 或模型名");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model());
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt + "\n\n请仅返回一个合法 JSON 对象，不要使用 Markdown 代码块。")));
        body.put("temperature", 0.2);
        body.put("max_tokens", 2048);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey());
        try {
            String raw = rest.postForObject(baseUrl() + "/chat/completions", new HttpEntity<>(body, headers), String.class);
            return parse(raw);
        } catch (RestClientResponseException e) {
            throw new IllegalStateException("模型服务返回 HTTP " + e.getStatusCode().value(), e);
        } catch (Exception e) {
            throw new IllegalStateException("模型服务调用失败：" + e.getMessage(), e);
        }
    }

    private Result parse(String raw) {
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
            return new Result(output, input, outputTokens, root.path("model").asText(model()));
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

    private String apiKey() { return "openai".equalsIgnoreCase(config.getProvider()) ? value(config.getOpenai().getApiKey()) : value(config.getTongyi().getApiKey()); }
    private String baseUrl() { return "openai".equalsIgnoreCase(config.getProvider()) ? value(config.getOpenai().getBaseUrl()) : value(config.getTongyi().getBaseUrl()); }
    private String model() { return "openai".equalsIgnoreCase(config.getProvider()) ? value(config.getOpenai().getModel()) : value(config.getTongyi().getModel()); }
    private String value(String value) { return value == null ? "" : value.trim().replaceAll("/$", ""); }
}
