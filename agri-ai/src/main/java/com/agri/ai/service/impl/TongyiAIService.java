package com.agri.ai.service.impl;

import com.agri.ai.config.AIConfig;
import com.agri.ai.service.AIService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service("tongyiAIService")
public class TongyiAIService implements AIService {

    private final AIConfig.TongyiConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public TongyiAIService(AIConfig config) {
        this.config = config.getTongyi();
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String chat(String prompt) {
        return callAPI(prompt);
    }

    @Override
    public String recommend(String context) {
        String prompt = "基于以下农业生产数据，给出智能推荐建议：\n" + context;
        return callAPI(prompt);
    }

    @Override
    public String riskAnalysis(String context) {
        String prompt = "分析以下农业供应链数据的风险：\n" + context;
        return callAPI(prompt);
    }

    @Override
    public String summarize(String text) {
        String prompt = "请总结以下文本内容：\n" + text;
        return callAPI(prompt);
    }

    private String callAPI(String prompt) {
        try {
            String url = config.getBaseUrl() + "/completions";
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "qwen-turbo");
            requestBody.put("prompt", prompt);
            requestBody.put("max_tokens", 2048);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + config.getApiKey());
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            String response = restTemplate.postForObject(url, request, String.class);
            
            JsonNode jsonNode = objectMapper.readTree(response);
            List<JsonNode> choices = jsonNode.findValues("text");
            if (!choices.isEmpty()) {
                return choices.get(0).asText();
            }
            
            return "AI服务响应异常";
        } catch (Exception e) {
            log.error("调用通义千问API失败", e);
            return "AI服务暂时不可用，请稍后重试";
        }
    }
}