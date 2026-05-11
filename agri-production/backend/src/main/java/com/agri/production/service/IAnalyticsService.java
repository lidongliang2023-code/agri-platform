package com.agri.production.service;

import java.util.Map;

public interface IAnalyticsService {

    Map<String, Object> getProductionOverview(String tenantId);

    Map<String, Object> getTaskStatistics(String tenantId);

    Map<String, Object> getHarvestStatistics(String tenantId);

    Map<String, Object> getInputMaterialStatistics(String tenantId);

    Map<String, Object> getFarmDashboard(String tenantId, Long farmId);
}