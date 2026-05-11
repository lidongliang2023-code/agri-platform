package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IAIAssistantService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/ai")
public class AIAssistantController {

    private final IAIAssistantService aiAssistantService;

    public AIAssistantController(IAIAssistantService aiAssistantService) {
        this.aiAssistantService = aiAssistantService;
    }

    @PostMapping("/ask")
    public ApiResponse<Map<String, Object>> askQuestion(@RequestBody Map<String, String> request) {
        String question = request.get("question");
        Map<String, Object> result = aiAssistantService.askQuestion(question, "T001");
        return ApiResponse.success(result);
    }

    @PostMapping("/diagnose")
    public ApiResponse<Map<String, Object>> diagnoseDisease(@RequestBody Map<String, String> request) {
        String imageUrl = request.get("imageUrl");
        String cropType = request.get("cropType");
        String symptoms = request.get("symptoms");
        Map<String, Object> result = aiAssistantService.diagnoseDisease(imageUrl, cropType, symptoms, "T001");
        return ApiResponse.success(result);
    }

    @PostMapping("/predict-yield")
    public ApiResponse<Map<String, Object>> predictYield(@RequestBody Map<String, Object> request) {
        Long farmId = request.get("farmId") != null ? ((Number) request.get("farmId")).longValue() : null;
        Long plotId = request.get("plotId") != null ? ((Number) request.get("plotId")).longValue() : null;
        String cropType = (String) request.get("cropType");
        String plantingDate = (String) request.get("plantingDate");
        Map<String, Object> result = aiAssistantService.predictYield(farmId, plotId, cropType, plantingDate, "T001");
        return ApiResponse.success(result);
    }

    @PostMapping("/recommend-input")
    public ApiResponse<Map<String, Object>> recommendInputMaterial(@RequestBody Map<String, Object> request) {
        Long plotId = request.get("plotId") != null ? ((Number) request.get("plotId")).longValue() : null;
        String cropType = (String) request.get("cropType");
        String growthStage = (String) request.get("growthStage");
        Map<String, Object> result = aiAssistantService.recommendInputMaterial(plotId, cropType, growthStage, "T001");
        return ApiResponse.success(result);
    }

    @PostMapping("/analyze-soil")
    public ApiResponse<Map<String, Object>> analyzeSoil(@RequestBody Map<String, Object> soilData) {
        Map<String, Object> result = aiAssistantService.analyzeSoil(soilData, "T001");
        return ApiResponse.success(result);
    }
}