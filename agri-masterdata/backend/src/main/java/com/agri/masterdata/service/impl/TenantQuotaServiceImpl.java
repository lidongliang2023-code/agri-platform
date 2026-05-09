package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.TenantQuota;
import com.agri.masterdata.mapper.TenantQuotaMapper;
import com.agri.masterdata.service.ITenantQuotaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TenantQuotaServiceImpl implements ITenantQuotaService {

    private final TenantQuotaMapper tenantQuotaMapper;

    @Override
    public List<TenantQuota> getByTenantId(String tenantId) {
        return tenantQuotaMapper.selectByTenantId(tenantId);
    }

    @Override
    public TenantQuota getByTenantIdAndType(String tenantId, String quotaType) {
        return tenantQuotaMapper.selectByTenantIdAndType(tenantId, quotaType);
    }

    @Override
    @Transactional
    public void saveQuota(String tenantId, String quotaType, Integer maxValue) {
        TenantQuota existing = tenantQuotaMapper.selectByTenantIdAndType(tenantId, quotaType);
        if (existing != null) {
            throw new BusinessException("配额类型已存在");
        }

        TenantQuota quota = new TenantQuota();
        quota.setTenantId(tenantId);
        quota.setQuotaType(quotaType);
        quota.setMaxValue(maxValue);
        quota.setCurrentValue(0);
        quota.setStatus(1);
        tenantQuotaMapper.insert(quota);
    }

    @Override
    @Transactional
    public void updateQuota(String tenantId, String quotaType, Integer maxValue) {
        TenantQuota quota = tenantQuotaMapper.selectByTenantIdAndType(tenantId, quotaType);
        if (quota == null) {
            throw new BusinessException("配额不存在");
        }

        quota.setMaxValue(maxValue);
        tenantQuotaMapper.updateById(quota);
    }

    @Override
    @Transactional
    public void updateCurrentValue(String tenantId, String quotaType, Integer currentValue) {
        TenantQuota quota = tenantQuotaMapper.selectByTenantIdAndType(tenantId, quotaType);
        if (quota == null) {
            throw new BusinessException("配额不存在");
        }

        quota.setCurrentValue(currentValue);
        tenantQuotaMapper.updateById(quota);
    }

    @Override
    public void checkQuota(String tenantId, String quotaType, int count) {
        TenantQuota quota = tenantQuotaMapper.selectByTenantIdAndType(tenantId, quotaType);
        if (quota == null) {
            throw new BusinessException("配额未配置");
        }

        if (quota.getCurrentValue() + count > quota.getMaxValue()) {
            throw new BusinessException("租户配额已用完");
        }
    }
}