package com.agri.ai.controller;

import com.agri.ai.service.AIService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ai")
public class AIController {

    private final AIService aiService;

    public AIController(com.agri.ai.service.impl.AIServiceProxy aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");
        String response = aiService.chat(prompt);
        return Map.of("code", 200, "message", "success", "data", response);
    }

    @PostMapping("/recommend")
    public Map<String, Object> recommend(@RequestBody Map<String, String> request) {
        String context = request.get("context");
        String response = aiService.recommend(context);
        return Map.of("code", 200, "message", "success", "data", response);
    }

    @PostMapping("/risk-analysis")
    public Map<String, Object> riskAnalysis(@RequestBody Map<String, String> request) {
        String context = request.get("context");
        String response = aiService.riskAnalysis(context);
        return Map.of("code", 200, "message", "success", "data", response);
    }

    @PostMapping("/summarize")
    public Map<String, Object> summarize(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        String response = aiService.summarize(text);
        return Map.of("code", 200, "message", "success", "data", response);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatRequest {
        private String prompt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendRequest {
        private String context;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskAnalysisRequest {
        private String context;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummarizeRequest {
        private String text;
    }
}