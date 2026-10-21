package com.agri.produce.internal.admin;

import com.agri.core.infra.tenant.TenantSubjectProvider;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产运营端租户视图。
 *
 * <p>租户主档统一来自平台经营主体，生产域只补充资源配额配置。</p>
 */
@Service
@RequiredArgsConstructor
public class TenantSubjectService {

    private final TenantSubjectProvider tenantSubjectProvider;
    private final TenantQuotaMapper tenantQuotaMapper;

    public PageResult<OpsTenantSubjectRow> page(long page, long size, String keyword,
                                                Integer status, String memberType) {
        PageResult<TenantSubjectProvider.TenantSubject> subjects =
                tenantSubjectProvider.page(page, size, keyword, status, memberType);
        Map<Long, TenantQuotaEntity> quotas = quotasByTenant(subjects.getRecords().stream()
                .map(TenantSubjectProvider.TenantSubject::tenantId).toList());
        return PageResult.of(subjects.getRecords().stream()
                        .map(subject -> toRow(subject, quotas.get(subject.tenantId()))).toList(),
                subjects.getTotal(), subjects.getPage(), subjects.getSize());
    }

    public OpsTenantSubjectRow detail(Long tenantId) {
        TenantSubjectProvider.TenantSubject subject = tenantSubjectProvider.findById(tenantId);
        TenantQuotaEntity quota = tenantQuotaMapper.selectOne(new LambdaQueryWrapper<TenantQuotaEntity>()
                .eq(TenantQuotaEntity::getTenantId, tenantId)
                .orderByDesc(TenantQuotaEntity::getCreatedAt)
                .last("LIMIT 1"));
        return toRow(subject, quota);
    }

    public OpsTenantSubjectRow update(Long tenantId, TenantSubjectProvider.TenantSubjectUpdate request) {
        return detail(tenantSubjectProvider.update(tenantId, request).tenantId());
    }

    private Map<Long, TenantQuotaEntity> quotasByTenant(List<Long> tenantIds) {
        Map<Long, TenantQuotaEntity> result = new HashMap<>();
        if (tenantIds.isEmpty()) {
            return result;
        }
        List<TenantQuotaEntity> quotas = tenantQuotaMapper.selectList(
                new LambdaQueryWrapper<TenantQuotaEntity>()
                        .in(TenantQuotaEntity::getTenantId, tenantIds)
                        .orderByDesc(TenantQuotaEntity::getCreatedAt));
        for (TenantQuotaEntity quota : quotas) {
            if (quota.getTenantId() != null) {
                result.putIfAbsent(quota.getTenantId(), quota);
            }
        }
        return result;
    }

    private OpsTenantSubjectRow toRow(TenantSubjectProvider.TenantSubject subject, TenantQuotaEntity quota) {
        OpsTenantSubjectRow row = new OpsTenantSubjectRow();
        row.setTenantId(subject.tenantId());
        row.setTenantCode(subject.tenantCode());
        row.setTenantName(subject.tenantName());
        row.setMemberType(subject.memberType());
        row.setIndustry(subject.industry());
        row.setBusinessType(subject.businessType());
        row.setContactName(subject.contactName());
        row.setContactPhone(subject.contactPhone());
        row.setStatus(subject.status());
        row.setVerifyStatus(subject.verifyStatus());
        row.setCreatedAt(subject.createdAt());
        row.setQuotaRegistered(quota != null);
        if (quota != null) {
            row.setQuotaId(quota.getQuotaId());
            row.setFarmLimit(quota.getFarmLimit());
            row.setUsedFarmCount(quota.getUsedFarmCount() == null ? 0 : quota.getUsedFarmCount());
            row.setTraceCodeLimit(quota.getTraceCodeLimit());
            row.setStorageLimitGb(quota.getStorageLimitGb());
            row.setApiCallLimit(quota.getApiCallLimit());
        } else {
            row.setUsedFarmCount(0);
        }
        return row;
    }
}
