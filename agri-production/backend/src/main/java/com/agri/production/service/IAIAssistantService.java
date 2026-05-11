package com.agri.production.service;

import java.util.Map;

public interface IAIAssistantService {

    Map<String, Object> askQuestion(String question, String tenantId);

    Map<String, Object> diagnoseDisease(String imageUrl, String cropType, String symptoms, String tenantId);

    Map<String, Object> predictYield(Long farmId, Long plotId, String cropType, String plantingDate, String tenantId);

    Map<String, Object> recommendInputMaterial(Long plotId, String cropType, String growthStage, String tenantId);

    Map<String, Object> analyzeSoil(Map<String, Object> soilData, String tenantId);
}