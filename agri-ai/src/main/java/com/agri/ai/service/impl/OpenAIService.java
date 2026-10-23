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
@Service("openAIService")
public class OpenAIService implements AIService {

    private final AIConfig.OpenAIConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public OpenAIService(AIConfig config) {
        this.config = config.getOpenai();
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String chat(String prompt) {
        return callAPI(prompt);
    }

    @Override
    public String recommend(String context) {
        String prompt = "Based on the following agricultural production data, provide intelligent recommendations:\n" + context;
        return callAPI(prompt);
    }

    @Override
    public String riskAnalysis(String context) {
        String prompt = "Analyze the risks in the following agricultural supply chain data:\n" + context;
        return callAPI(prompt);
    }

    @Override
    public String summarize(String text) {
        String prompt = "Please summarize the following text:\n" + text;
        return callAPI(prompt);
    }

    private String callAPI(String prompt) {
        try {
            String url = config.getBaseUrl() + "/chat/completions";
            
            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", prompt);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "gpt-3.5-turbo");
            requestBody.put("messages", List.of(message));
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + config.getApiKey());
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            String response = restTemplate.postForObject(url, request, String.class);
            
            JsonNode jsonNode = objectMapper.readTree(response);
            JsonNode choices = jsonNode.get("choices");
            if (choices != null && choices.isArray() && choices.size() > 0) {
                JsonNode messageNode = choices.get(0).get("message");
                if (messageNode != null) {
                    return messageNode.get("content").asText();
                }
            }
            
            return "AI服务响应异常";
        } catch (Exception e) {
            log.error("调用OpenAI API失败", e);
            return "AI服务暂时不可用，请稍后重试";
        }
    }
}