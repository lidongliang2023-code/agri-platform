package com.agri.production.service;

import java.util.Map;

public interface IProductionAdminService {

    Map<String, Object> getAdminOverview();

    Map<String, Object> getFarmStatistics();

    Map<String, Object> getTaskStatistics();

    Map<String, Object> getHarvestStatistics();

    Map<String, Object> getAlertStatistics();

    Map<String, Object> getDeviceStatistics();

    Map<String, Object> getTraceStatistics();
}
