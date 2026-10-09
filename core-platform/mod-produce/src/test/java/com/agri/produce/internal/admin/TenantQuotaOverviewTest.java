package com.agri.produce.internal.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 运营端租户配额概览 单元测试。
 *
 * <p>核心守卫点：<strong>不允许把「没有数据源」伪装成「用量为 0」</strong>——
 * 农场数有真实用量列，其余三项必须标记 {@code source=NONE}。</p>
 */
@ExtendWith(MockitoExtension.class)
class TenantQuotaOverviewTest {

    @Mock
    private TenantQuotaMapper tenantQuotaMapper;

    @Mock
    private com.agri.produce.internal.farm.FarmInfoMapper farmInfoMapper;

    @Mock
    private com.agri.produce.internal.trace.TraceCodeMapper traceCodeMapper;

    @InjectMocks
    private TenantQuotaService service;

    private TenantQuotaEntity quota(String quotaId, String code, Integer farmLimit, Integer usedFarm) {
        TenantQuotaEntity entity = new TenantQuotaEntity();
        entity.setQuotaId(quotaId);
        entity.setTenantCode(code);
        entity.setTenantName("测试租户");
        entity.setFarmLimit(farmLimit);
        entity.setUsedFarmCount(usedFarm);
        entity.setTraceCodeLimit(10000);
        entity.setStorageLimitGb(new BigDecimal("50"));
        entity.setApiCallLimit(5000);
        entity.setStatus(1);
        return entity;
    }

    @Test
    void quotaOverview_marksFarmAsRealAndTraceUnavailableWhenUntagged() {
        // 该配额未打标（tenantId 为 null，等同 0）
        when(tenantQuotaMapper.selectById("QUOT-1")).thenReturn(quota("QUOT-1", "T001", 5, 4));

        List<OpsQuotaItem> items = service.quotaOverview("QUOT-1");

        assertThat(items).hasSize(4);
        assertThat(items.get(0).getKey()).isEqualTo("farm");
        assertThat(items.get(0).getSource()).isEqualTo(OpsQuotaItem.SOURCE_COLUMN);
        assertThat(items.get(0).getUsed()).isEqualTo(4D);
        assertThat(items.get(0).getUsageRate()).isEqualTo(80D);

        // 溯源码：有数据源，但租户未打标时按 tenant_id 聚合 = 全平台未打标总量，不可展示
        assertThat(items.get(1).getKey()).isEqualTo("traceCode");
        assertThat(items.get(1).getSource()).isEqualTo(OpsQuotaItem.SOURCE_UNAVAILABLE);
        assertThat(items.get(1).getUsed()).isEqualTo(0D);

        // 真·无数据源的两项：used 为 0 仅为满足结构，必须带 NONE 标记
        assertThat(items.get(2).getKey()).isEqualTo("storage");
        assertThat(items.get(3).getKey()).isEqualTo("api");
        for (OpsQuotaItem item : items.subList(2, 4)) {
            assertThat(item.getSource()).isEqualTo(OpsQuotaItem.SOURCE_NONE);
            assertThat(item.getUsed()).isEqualTo(0D);
        }
    }

    /** 租户已打标时，溯源码应给出真实用量并标 COLUMN */
    @Test
    void quotaOverview_traceCodeUsesRealCountWhenTenantTagged() {
        TenantQuotaEntity tagged = quota("QUOT-2", "T002", 5, 4);
        tagged.setTenantId(10100L);
        when(tenantQuotaMapper.selectById("QUOT-2")).thenReturn(tagged);
        when(traceCodeMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(7L);

        List<OpsQuotaItem> items = service.quotaOverview("QUOT-2");

        assertThat(items.get(1).getKey()).isEqualTo("traceCode");
        assertThat(items.get(1).getSource()).isEqualTo(OpsQuotaItem.SOURCE_COLUMN);
        assertThat(items.get(1).getUsed()).isEqualTo(7D).as("溯源码有数据源，不得再写死 0");
    }

    @Test
    void quotaOverview_zeroLimitIsNotDividedByZero() {
        when(tenantQuotaMapper.selectById("QUOT-1")).thenReturn(quota("QUOT-1", "T001", 0, 3));

        List<OpsQuotaItem> items = service.quotaOverview("QUOT-1");

        assertThat(items.get(0).getUsageRate()).isEqualTo(0D);
    }

    @Test
    void resolveTenant_fallsBackToTenantCode() {
        when(tenantQuotaMapper.selectById("T001")).thenReturn(null);
        when(tenantQuotaMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(quota("QUOT-9", "T001", 5, 1));

        TenantQuotaEntity entity = service.resolveTenant("T001");

        assertThat(entity.getQuotaId()).isEqualTo("QUOT-9");
    }

    @Test
    void resolveTenant_unknownThrowsNotFound() {
        when(tenantQuotaMapper.selectById("NOPE")).thenReturn(null);
        when(tenantQuotaMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        assertThatThrownBy(() -> service.resolveTenant("NOPE"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("NOPE");
    }

    @Test
    void quotaOverviewPage_onlyWarningFiltersLowUsage() {
        TenantQuotaEntity low = quota("QUOT-1", "T001", 100, 1);
        TenantQuotaEntity high = quota("QUOT-2", "T002", 5, 4);
        when(tenantQuotaMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(low, high));

        PageResult<OpsTenantQuotaRow> all = service.quotaOverviewPage(1, 10, null, false);
        assertThat(all.getTotal()).isEqualTo(2);

        PageResult<OpsTenantQuotaRow> warned = service.quotaOverviewPage(1, 10, null, true);
        assertThat(warned.getTotal()).isEqualTo(1);
        assertThat(warned.getRecords().get(0).getTenantCode()).isEqualTo("T002");
        assertThat(warned.getRecords().get(0).getMaxUsageRate()).isEqualTo(80D);
    }

    @Test
    void batchUpdateQuotaLimits_partialFailureDoesNotRollbackOthers() {
        when(tenantQuotaMapper.selectById("T001")).thenReturn(quota("QUOT-1", "T001", 5, 1));
        when(tenantQuotaMapper.selectById("NO-SUCH")).thenReturn(null);
        when(tenantQuotaMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(tenantQuotaMapper.updateById(any(TenantQuotaEntity.class))).thenReturn(1);

        List<QuotaLimitBatchResult> results =
                service.batchUpdateQuotaLimits(List.of("T001", "NO-SUCH"), 30, null, null, null);

        assertThat(results).hasSize(2);
        assertThat(results.get(0).isSuccess()).isTrue();
        assertThat(results.get(1).isSuccess()).isFalse();
        assertThat(results.get(1).getReason()).contains("NO-SUCH");
    }

    @Test
    void batchUpdateQuotaLimits_emptyIdsRejected() {
        assertThatThrownBy(() -> service.batchUpdateQuotaLimits(List.of(), 30, null, null, null))
                .isInstanceOf(BusinessException.class);
    }
}
