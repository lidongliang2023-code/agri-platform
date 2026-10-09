package com.agri.produce.internal.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.agri.shared.exception.BusinessException;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.trace.TraceCodeEntity;
import com.agri.produce.internal.trace.TraceCodeMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 租户配额用量统计 单元测试。
 *
 * <p><b>守卫点：</b>用量必须按<b>租户维度</b>统计。历史 bug 是 {@code selectCount} 不带任何条件，
 * 把「全平台总数」写进单个租户的 {@code used_farm_count}，且 HTTP 状态与 code 一切正常。</p>
 *
 * <p><b>为什么断言取三个两两不同的数字（A=2 / B=3 / 平台=12）：</b>
 * 这样任何一维失效都会被抓到，而不是「返回一个数字就算过」——
 * 按平台统计 → A、B 都返回 12；按 marketId 统计 → A、B 都返回 12；
 * 租户条件传错 → 落到兜底 12 或 0，均与 2/3 不同。
 * 请勿把这里简化成单条断言。</p>
 */
@ExtendWith(MockitoExtension.class)
class TenantQuotaServiceTest {

    @Mock
    private TenantQuotaMapper tenantQuotaMapper;

    @Mock
    private FarmInfoMapper farmInfoMapper;

    @Mock
    private TraceCodeMapper traceCodeMapper;

    @InjectMocks
    private TenantQuotaService service;

    /**
     * 安装 MyBatis-Plus 的 lambda 缓存。
     *
     * <p>本测试要断言 wrapper 里携带的租户条件值，必须先把 wrapper 的 SQL 段物化；
     * 而物化 lambda 列需要 {@code LambdaUtils} 缓存，该缓存平时由 MyBatis 启动时填充。
     * 纯单测没有启动过程，不装会抛「can not find lambda cache for this entity」。</p>
     */
    @BeforeAll
    static void initMybatisPlusLambdaCache() {
        MapperBuilderAssistant assistant =
                new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, FarmInfoEntity.class);
        TableInfoHelper.initTableInfo(assistant, TraceCodeEntity.class);
    }

    private TenantQuotaEntity quota(String quotaId, Long tenantId) {
        TenantQuotaEntity entity = new TenantQuotaEntity();
        entity.setQuotaId(quotaId);
        entity.setTenantId(tenantId);
        entity.setTenantCode("T-" + quotaId);
        entity.setTenantName("测试租户");
        entity.setFarmLimit(30);
        entity.setUsedFarmCount(0);
        entity.setStatus(1);
        return entity;
    }

    /**
     * 从 wrapper 里取出租户条件值（LambdaQueryWrapper 的等值参数）。
     *
     * <p>注意：MP 3.5.x 的 wrapper 是<b>惰性求值</b>的——条件在构造时只是挂了 Supplier，
     * 要等 SQL 段被物化（正常由 MyBatis 执行时触发）才会真正写入 {@code paramNameValuePairs}。
     * 单测里 mapper 是 mock，没人触发，故必须显式调用 {@code getSqlSegment()} 先物化，
     * 否则读到的是空 Map。</p>
     */
    private static Long tenantValueOf(LambdaQueryWrapper<?> wrapper) {
        wrapper.getSqlSegment();
        for (Map.Entry<String, Object> entry : wrapper.getParamNameValuePairs().entrySet()) {
            if (entry.getValue() instanceof Long value) {
                return value;
            }
        }
        return null;
    }

    @Test
    void resetUsage_countsFarmsPerTenant_notPlatformTotal() {
        when(tenantQuotaMapper.selectById("QUOT-A")).thenReturn(quota("QUOT-A", 10100L));
        when(tenantQuotaMapper.selectById("QUOT-B")).thenReturn(quota("QUOT-B", 10200L));

        List<Long> tenantsSeen = new ArrayList<>();
        when(farmInfoMapper.selectCount(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> {
            LambdaQueryWrapper<?> wrapper = invocation.getArgument(0);
            Long tenant = tenantValueOf(wrapper);
            tenantsSeen.add(tenant);
            if (Long.valueOf(10100L).equals(tenant)) {
                return 2L;
            }
            if (Long.valueOf(10200L).equals(tenant)) {
                return 3L;
            }
            return 12L; // 没有租户条件 → 全平台总数
        });

        int usedA = service.resetUsage("QUOT-A").getUsedFarmCount();
        int usedB = service.resetUsage("QUOT-B").getUsedFarmCount();

        assertThat(usedA).isEqualTo(2);
        assertThat(usedB).isEqualTo(3);
        assertThat(usedA).isNotEqualTo(usedB).as("两个租户的用量不应相等");
        assertThat(usedA).isNotEqualTo(12).as("A 不得退化为全平台总数");
        assertThat(usedB).isNotEqualTo(12).as("B 不得退化为全平台总数");
        assertThat(tenantsSeen).containsExactly(10100L, 10200L)
                .as("两次统计必须各带本租户的 tenantId");
    }

    /**
     * 租户未打标（tenant_id = 0 / null）时必须拒绝：此时 {@code tenant_id = 0} 会命中
     * 全部未打标行，数值等于全平台未打标总量，与「把全平台总数写进单租户」是同一个坑。
     */
    @Test
    void resetUsage_rejectsUntaggedTenant() {
        when(tenantQuotaMapper.selectById("QUOT-ZERO")).thenReturn(quota("QUOT-ZERO", 0L));
        when(tenantQuotaMapper.selectById("QUOT-NULL")).thenReturn(quota("QUOT-NULL", null));

        assertThatThrownBy(() -> service.resetUsage("QUOT-ZERO"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("未绑定 tenant_id");
        assertThatThrownBy(() -> service.resetUsage("QUOT-NULL"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("未绑定 tenant_id");

        // 关键：未打标租户不得触发任何统计，杜绝写入「全平台未打标总量」
        verifyNoInteractions(farmInfoMapper);
    }

    @Test
    void countTraceCodeUsage_scopedByTenant() {
        List<Long> tenantsSeen = new ArrayList<>();
        when(traceCodeMapper.selectCount(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> {
            LambdaQueryWrapper<?> wrapper = invocation.getArgument(0);
            Long tenant = tenantValueOf(wrapper);
            tenantsSeen.add(tenant);
            if (Long.valueOf(10100L).equals(tenant)) {
                return 5L;
            }
            if (Long.valueOf(10200L).equals(tenant)) {
                return 9L;
            }
            return 100L;
        });

        assertThat(service.countTraceCodeUsage(10100L)).isEqualTo(5L);
        assertThat(service.countTraceCodeUsage(10200L)).isEqualTo(9L);
        assertThat(tenantsSeen).containsExactly(10100L, 10200L);
    }

    @Test
    void countTraceCodeUsage_nullTenantTreatedAsZero() {
        when(traceCodeMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(4L);

        assertThat(service.countTraceCodeUsage(null)).isEqualTo(4L);
    }
}
