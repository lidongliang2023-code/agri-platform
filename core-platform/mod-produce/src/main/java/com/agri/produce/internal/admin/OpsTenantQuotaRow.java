package com.agri.produce.internal.admin;

import lombok.Data;

/**
 * 运营端全平台配额一览行（对齐前端 {@code OpsTenantQuotaRow}）。
 *
 * <p>注意：库内<strong>没有租户主表</strong>，租户目前只是 {@code prod_tenant_quota} 上的一行，
 * 故 {@code tenantId} 取配额记录的业务主键 {@code quotaId}，{@code segment} 无数据源保持 null。</p>
 */
@Data
public class OpsTenantQuotaRow {

    /** 租户 ID（无租户主表，此处为配额记录主键） */
    private String tenantId;

    /** 租户编号 */
    private String tenantCode;

    /** 租户名称 */
    private String tenantName;

    /** 分层；无数据源，恒为 null */
    private String segment;

    private OpsQuotaItem farm;

    private OpsQuotaItem traceCode;

    private OpsQuotaItem storage;

    private OpsQuotaItem api;

    /** 四项中最高使用率（%） */
    private Double maxUsageRate;

    /** 更新时间 */
    private String updatedAt;

    /**
     * 由配额实体组装一行。
     *
     * @param quota 配额实体
     * @return 一览行
     */
    public static OpsTenantQuotaRow of(TenantQuotaEntity quota) {
        OpsTenantQuotaRow row = new OpsTenantQuotaRow();
        row.setTenantId(quota.getQuotaId());
        row.setTenantCode(quota.getTenantCode());
        row.setTenantName(quota.getTenantName());
        row.setSegment(null);
        row.setFarm(buildFarm(quota));
        row.setTraceCode(buildTraceCode(quota));
        row.setStorage(buildStorage(quota));
        row.setApi(buildApi(quota));
        row.setMaxUsageRate(max(row.getFarm(), row.getTraceCode(), row.getStorage(), row.getApi()));
        row.setUpdatedAt(quota.getUpdatedAt() == null ? null : quota.getUpdatedAt().toString());
        return row;
    }

    private static OpsQuotaItem buildFarm(TenantQuotaEntity quota) {
        return OpsQuotaItem.of("farm", "农场数", "个",
                quota.getUsedFarmCount() == null ? 0D : quota.getUsedFarmCount().doubleValue(),
                quota.getFarmLimit() == null ? 0D : quota.getFarmLimit().doubleValue(),
                0, quota.getUpdatedAt() == null ? null : quota.getUpdatedAt().toString(),
                quota.getQuotaId(), 1, OpsQuotaItem.SOURCE_COLUMN);
    }

    private static OpsQuotaItem buildTraceCode(TenantQuotaEntity quota) {
        return OpsQuotaItem.of("traceCode", "溯源码", "个", 0D,
                quota.getTraceCodeLimit() == null ? 0D : quota.getTraceCodeLimit().doubleValue(),
                0, quota.getUpdatedAt() == null ? null : quota.getUpdatedAt().toString(),
                quota.getQuotaId(), 0, OpsQuotaItem.SOURCE_NONE);
    }

    private static OpsQuotaItem buildStorage(TenantQuotaEntity quota) {
        return OpsQuotaItem.of("storage", "存储空间", "GB", 0D,
                quota.getStorageLimitGb() == null ? 0D : quota.getStorageLimitGb().doubleValue(),
                2, quota.getUpdatedAt() == null ? null : quota.getUpdatedAt().toString(),
                quota.getQuotaId(), 5, OpsQuotaItem.SOURCE_NONE);
    }

    private static OpsQuotaItem buildApi(TenantQuotaEntity quota) {
        return OpsQuotaItem.of("api", "API 调用", "次/日", 0D,
                quota.getApiCallLimit() == null ? 0D : quota.getApiCallLimit().doubleValue(),
                0, quota.getUpdatedAt() == null ? null : quota.getUpdatedAt().toString(),
                quota.getQuotaId(), 6, OpsQuotaItem.SOURCE_NONE);
    }

    private static Double max(OpsQuotaItem... items) {
        double max = 0D;
        for (OpsQuotaItem item : items) {
            if (item != null && item.getUsageRate() != null && item.getUsageRate() > max) {
                max = item.getUsageRate();
            }
        }
        return max;
    }
}
