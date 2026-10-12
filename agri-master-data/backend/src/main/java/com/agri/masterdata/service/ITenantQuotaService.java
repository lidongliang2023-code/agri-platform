package com.agri.masterdata.service;

import com.agri.masterdata.entity.TenantQuota;

import java.util.List;

public interface ITenantQuotaService {

    List<TenantQuota> getByTenantId(String tenantId);

    TenantQuota getByTenantIdAndType(String tenantId, String quotaType);

    void saveQuota(String tenantId, String quotaType, Integer maxValue);

    void updateQuota(String tenantId, String quotaType, Integer maxValue);

    void updateCurrentValue(String tenantId, String quotaType, Integer currentValue);

    void checkQuota(String tenantId, String quotaType, int count);
}