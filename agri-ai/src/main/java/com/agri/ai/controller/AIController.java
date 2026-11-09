package com.agri.ai.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.agri.ai.service.AIService;
import com.agri.ai.service.AiHubDispatcher;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping({"/ai", "/api/ai"})
public class AIController {

    private final AIService aiService;
    private final AiHubDispatcher aiHubDispatcher;

    public AIController(com.agri.ai.service.impl.AIServiceProxy aiService,
                        AiHubDispatcher aiHubDispatcher) {
        this.aiService = aiService;
        this.aiHubDispatcher = aiHubDispatcher;
    }

    /**
     * 现代农业产业互联网 AI 中台统一标准调用端点 (REST API)
     * 支持全平台 8 大业务子系统场景调度与状态审计
     */
    @PostMapping("/invoke")
    public AiInvokeResponse invoke(@RequestBody AiInvokeRequest request) {
        return aiHubDispatcher.dispatch(request);
    }

    /**
     * 统一登录态与 AI 中台子域健康状态感知
     */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> getStatus() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("subsystem", "agri-ai");
        data.put("role", "AI智算中枢子域");
        data.put("status", "UP");
        data.put("authIntegrated", true);
        data.put("isLogin", StpUtil.isLogin());
        if (StpUtil.isLogin()) {
            data.put("loginId", StpUtil.getLoginIdDefaultNull());
            data.put("tokenName", StpUtil.getTokenName());
            data.put("tokenValue", StpUtil.getTokenValue());
        }
        return ApiResponse.success("AI中台运行正常", data);
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
