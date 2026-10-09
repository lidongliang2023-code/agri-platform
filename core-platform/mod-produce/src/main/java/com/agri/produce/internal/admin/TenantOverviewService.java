package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.iot.IotDeviceMapper;
import com.agri.produce.internal.iot.IotDeviceService;
import com.agri.produce.internal.plan.PlanInfoMapper;
import com.agri.produce.internal.plan.PlanInfoService;
import com.agri.produce.internal.plot.PlotInfoMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 运营端「租户概览」应用服务：按 {@code tenant_id} 维度聚合生产域资源占用。
 *
 * <p>实现约束：
 * <ul>
 *     <li>只读，不写库、不发领域事件，因此无需事务；</li>
 *     <li>每类资源仅一条 {@code GROUP BY tenant_id} 聚合 SQL（共 6 条），不存在 N+1；</li>
 *     <li>行级隔离依赖 TenantLineInnerInterceptor 自动追加 {@code market_id}，本类不手写该条件，
 *         避免与 ADR-005 的实现耦合；</li>
 *     <li>全部计数缺省 0，概览不返回 {@code null} 计数（前端要做排序与除法）。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class TenantOverviewService {

    /** 配额告警阈值：农场配额使用率达到该百分比即计入告警 */
    public static final BigDecimal WARNING_USAGE_RATE = BigDecimal.valueOf(80);

    /** 未登记配额租户的编码前缀 */
    private static final String UNREGISTERED_CODE_PREFIX = "TENANT-";

    /** 未登记配额租户的展示名 */
    private static final String UNREGISTERED_NAME = "未登记租户";

    private final TenantQuotaMapper tenantQuotaMapper;
    private final FarmInfoMapper farmInfoMapper;
    private final PlotInfoMapper plotInfoMapper;
    private final IotDeviceMapper iotDeviceMapper;
    private final AlertInfoMapper alertInfoMapper;
    private final PlanInfoMapper planInfoMapper;

    /**
     * 平台级租户概览。
     *
     * @return 汇总卡片 + 逐租户明细行
     */
    public TenantOverview overview() {
        Map<Long, TenantQuotaEntity> quotaByTenant = loadQuotaByTenant();

        Map<Long, Long> farmCount = countByTenant(farmInfoMapper, null);
        Map<Long, Long> plotCount = countByTenant(plotInfoMapper, null);
        Map<Long, Long> deviceCount = countByTenant(iotDeviceMapper, null);
        Map<Long, Long> deviceOnlineCount = countByTenant(iotDeviceMapper, wrapper -> {
            LocalDateTime earliestAlive =
                    LocalDateTime.now().minusMinutes(IotDeviceService.HEARTBEAT_VALID_MINUTES);
            wrapper.eq("online_flag", 1).ge("last_heartbeat_at", earliestAlive);
        });
        Map<Long, Long> pendingAlertCount =
                countByTenant(alertInfoMapper, wrapper -> wrapper.eq("status", "PENDING"));
        Map<Long, Long> growingPlanCount =
                countByTenant(planInfoMapper, wrapper -> wrapper.in("status", PlanInfoService.GROWING_STATUSES));

        Set<Long> tenantIds = new LinkedHashSet<>(quotaByTenant.keySet());
        tenantIds.addAll(farmCount.keySet());
        tenantIds.addAll(plotCount.keySet());
        tenantIds.addAll(deviceCount.keySet());
        tenantIds.addAll(pendingAlertCount.keySet());
        tenantIds.addAll(growingPlanCount.keySet());

        List<TenantOverviewRow> rows = new ArrayList<>(tenantIds.size());
        TenantOverview overview = new TenantOverview();
        for (Long tenantId : tenantIds) {
            TenantOverviewRow row = buildRow(tenantId, quotaByTenant.get(tenantId),
                    farmCount, plotCount, deviceCount, deviceOnlineCount,
                    pendingAlertCount, growingPlanCount);
            rows.add(row);
            accumulate(overview, row);
        }
        rows.sort(Comparator.comparingLong(TenantOverviewRow::getFarmCount).reversed()
                .thenComparing(Comparator.comparingLong(TenantOverviewRow::getDeviceCount).reversed())
                .thenComparing(row -> String.valueOf(row.getTenantId())));

        overview.setTenantTotal(rows.size());
        overview.setRows(rows);
        return overview;
    }

    /**
     * 单租户概览。
     *
     * @param tenantId 租户 ID
     * @return 该租户的明细行
     */
    public TenantOverviewRow tenantOverview(Long tenantId) {
        if (tenantId == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST);
        }
        TenantOverview overview = overview();
        return overview.getRows().stream()
                .filter(row -> tenantId.equals(row.getTenantId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /**
     * 按租户加载配额（同一租户存在多条时，取最近创建的一条）。
     *
     * @return tenantId → 配额实体
     */
    private Map<Long, TenantQuotaEntity> loadQuotaByTenant() {
        List<TenantQuotaEntity> quotas = tenantQuotaMapper.selectList(
                new LambdaQueryWrapper<TenantQuotaEntity>()
                        .orderByDesc(TenantQuotaEntity::getCreatedAt));
        Map<Long, TenantQuotaEntity> result = new HashMap<>();
        for (TenantQuotaEntity quota : quotas) {
            Long tenantId = quota.getTenantId() == null ? 0L : quota.getTenantId();
            result.putIfAbsent(tenantId, quota);
        }
        return result;
    }

    /**
     * 组装单租户明细行。
     *
     * @param tenantId          租户 ID
     * @param quota             配额实体，未登记时为 {@code null}
     * @param farmCount         农场数
     * @param plotCount         地块数
     * @param deviceCount       设备数
     * @param deviceOnlineCount 在线设备数
     * @param pendingAlertCount 待处理告警数
     * @param growingPlanCount  在种计划数
     * @return 明细行
     */
    private TenantOverviewRow buildRow(Long tenantId,
                                       TenantQuotaEntity quota,
                                       Map<Long, Long> farmCount,
                                       Map<Long, Long> plotCount,
                                       Map<Long, Long> deviceCount,
                                       Map<Long, Long> deviceOnlineCount,
                                       Map<Long, Long> pendingAlertCount,
                                       Map<Long, Long> growingPlanCount) {
        TenantOverviewRow row = new TenantOverviewRow();
        row.setTenantId(tenantId);
        row.setFarmCount(countOf(farmCount, tenantId));
        row.setPlotCount(countOf(plotCount, tenantId));
        row.setDeviceCount(countOf(deviceCount, tenantId));
        row.setDeviceOnlineCount(countOf(deviceOnlineCount, tenantId));
        row.setPendingAlertCount(countOf(pendingAlertCount, tenantId));
        row.setGrowingPlanCount(countOf(growingPlanCount, tenantId));

        if (quota == null) {
            row.setRegistered(false);
            row.setTenantCode(UNREGISTERED_CODE_PREFIX + tenantId);
            row.setTenantName(UNREGISTERED_NAME);
            row.setStatus(null);
            row.setFarmLimit(null);
            row.setFarmUsageRate(BigDecimal.ZERO);
            row.setQuotaWarning(false);
            return row;
        }

        row.setRegistered(true);
        row.setTenantCode(quota.getTenantCode());
        row.setTenantName(quota.getTenantName());
        row.setStatus(quota.getStatus());
        row.setFarmLimit(quota.getFarmLimit());
        row.setFarmUsageRate(usageRate(row.getFarmCount(), quota.getFarmLimit()));
        row.setQuotaWarning(row.getFarmUsageRate().compareTo(WARNING_USAGE_RATE) >= 0);
        return row;
    }

    /**
     * 将明细行累加进汇总卡片。
     *
     * @param overview 汇总卡片
     * @param row     明细行
     */
    private void accumulate(TenantOverview overview, TenantOverviewRow row) {
        if (row.isRegistered()) {
            if (Integer.valueOf(1).equals(row.getStatus())) {
                overview.setActiveTenantCount(overview.getActiveTenantCount() + 1);
            } else if (Integer.valueOf(0).equals(row.getStatus())) {
                overview.setDisabledTenantCount(overview.getDisabledTenantCount() + 1);
            }
        } else {
            overview.setUnregisteredTenantCount(overview.getUnregisteredTenantCount() + 1);
        }
        overview.setFarmTotal(overview.getFarmTotal() + row.getFarmCount());
        overview.setPlotTotal(overview.getPlotTotal() + row.getPlotCount());
        overview.setDeviceTotal(overview.getDeviceTotal() + row.getDeviceCount());
        overview.setDeviceOnlineCount(overview.getDeviceOnlineCount() + row.getDeviceOnlineCount());
        overview.setPendingAlertCount(overview.getPendingAlertCount() + row.getPendingAlertCount());
        overview.setGrowingPlanCount(overview.getGrowingPlanCount() + row.getGrowingPlanCount());
        if (row.isQuotaWarning()) {
            overview.setQuotaWarningCount(overview.getQuotaWarningCount() + 1);
        }
    }

    /**
     * 按租户分组计数。
     *
     * @param mapper  Mapper
     * @param filters 附加过滤条件，可为 {@code null}
     * @param <T>     实体类型
     * @return tenantId → 计数
     */
    private <T> Map<Long, Long> countByTenant(BaseMapper<T> mapper, Consumer<QueryWrapper<T>> filters) {
        QueryWrapper<T> wrapper = new QueryWrapper<>();
        wrapper.select("tenant_id AS tenantId", "COUNT(*) AS cnt");
        if (filters != null) {
            filters.accept(wrapper);
        }
        wrapper.groupBy("tenant_id");
        Map<Long, Long> result = new HashMap<>();
        for (Map<String, Object> row : mapper.selectMaps(wrapper)) {
            result.put(readLong(row, "tenantId", "tenant_id", "TENANT_ID"),
                    readLong(row, "cnt", "CNT"));
        }
        return result;
    }

    /**
     * 从聚合结果行中读取长整型值（兼容不同驱动的大小写与驼峰策略差异）。
     *
     * @param row  聚合结果行
     * @param keys 候选列名，按优先级排列
     * @return 长整型值，缺失时为 0
     */
    private Long readLong(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value == null) {
                continue;
            }
            if (value instanceof Number) {
                return ((Number) value).longValue();
            }
            String text = value.toString();
            if (!text.isBlank()) {
                return Long.valueOf(text);
            }
        }
        return 0L;
    }

    /**
     * 取租户计数，缺失时返回 0。
     *
     * @param counts   计数表
     * @param tenantId 租户 ID
     * @return 计数
     */
    private int countOf(Map<Long, Long> counts, Long tenantId) {
        Long value = counts.get(tenantId);
        return value == null ? 0 : value.intValue();
    }

    /**
     * 计算配额使用率（百分比，保留 2 位）。
     *
     * @param used  已用量
     * @param limit 上限，为 {@code null} 或 0 时返回 0
     * @return 使用率百分比
     */
    private BigDecimal usageRate(long used, Integer limit) {
        if (limit == null || limit <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(used)
                .divide(BigDecimal.valueOf(limit.longValue()), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

}
