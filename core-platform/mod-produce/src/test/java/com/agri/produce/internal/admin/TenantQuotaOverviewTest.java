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
    void quotaOverview_marksOnlyFarmAsRealData() {
        when(tenantQuotaMapper.selectById("QUOT-1")).thenReturn(quota("QUOT-1", "T001", 5, 4));

        List<OpsQuotaItem> items = service.quotaOverview("QUOT-1");

        assertThat(items).hasSize(4);
        assertThat(items.get(0).getKey()).isEqualTo("farm");
        assertThat(items.get(0).getSource()).isEqualTo(OpsQuotaItem.SOURCE_COLUMN);
        assertThat(items.get(0).getUsed()).isEqualTo(4D);
        assertThat(items.get(0).getUsageRate()).isEqualTo(80D);

        // 无数据源的三项：used 为 0 仅为满足结构，必须带 NONE 标记
        for (OpsQuotaItem item : items.subList(1, 4)) {
            assertThat(item.getSource()).isEqualTo(OpsQuotaItem.SOURCE_NONE);
            assertThat(item.getUsed()).isEqualTo(0D);
        }
        assertThat(items.get(1).getKey()).isEqualTo("traceCode");
        assertThat(items.get(2).getKey()).isEqualTo("storage");
        assertThat(items.get(3).getKey()).isEqualTo("api");
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
