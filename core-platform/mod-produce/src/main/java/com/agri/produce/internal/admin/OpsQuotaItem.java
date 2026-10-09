package com.agri.produce.internal.admin;

import lombok.Data;

/**
 * 运营端配额概览单项（对齐前端 {@code types/tenant.ts#OpsQuotaItem}）。
 *
 * <p><b>数据来源诚实标记：</b>{@code source} 说明该用量的出处。当前有真实用量数据源的有两项：
 * 「农场数」取用量列 {@code prod_tenant_quota.used_farm_count}；
 * 「溯源码」按 {@code prod_trace_code.tenant_id} 实时聚合
 * （见 {@code TenantQuotaService#countTraceCodeUsage}）。
 * 存储 / API 调用<strong>没有任何用量数据源</strong>（既无用量列，也无可按租户聚合的业务表），
 * 因此 {@code used} 记为 0 且 {@code source = NONE}，<b>不伪造数字</b>。
 * 前端看到 {@code NONE} 应展示「—」而不是 0。</p>
 */
@Data
public class OpsQuotaItem {

    /** 有真实用量数据源 */
    public static final String SOURCE_COLUMN = "COLUMN";
    /** 无用量数据源（used 无意义，仅为满足结构） */
    public static final String SOURCE_NONE = "NONE";

    /** 配额编码 farm / traceCode / storage / api */
    private String key;

    /** 配额名称 */
    private String name;

    /** 计量单位 */
    private String unit;

    /** 已使用量 */
    private Double used;

    /** 配额上限 */
    private Double limit;

    /** 使用率（%） */
    private Double usageRate;

    /** 展示小数位 */
    private Integer precision;

    /** 更新时间 */
    private String updatedAt;

    /** 后端配额记录 ID */
    private String quotaId;

    /** 后端配额类型：1 农场数 5 存储容量 6 API 调用；溯源码无枚举记为 0 */
    private Integer quotaType;

    /** 用量数据来源：COLUMN / NONE */
    private String source;

    /**
     * 构造一个配额项。
     *
     * @param key       配额编码
     * @param name      名称
     * @param unit      单位
     * @param used      已用量
     * @param limit     上限
     * @param precision 小数位
     * @param updatedAt 更新时间
     * @param quotaId   配额记录ID
     * @param quotaType 配额类型
     * @param source    数据来源
     * @return 配额项
     */
    public static OpsQuotaItem of(String key, String name, String unit, Double used, Double limit,
                                  Integer precision, String updatedAt, String quotaId,
                                  Integer quotaType, String source) {
        OpsQuotaItem item = new OpsQuotaItem();
        item.setKey(key);
        item.setName(name);
        item.setUnit(unit);
        item.setUsed(used == null ? 0D : used);
        item.setLimit(limit == null ? 0D : limit);
        item.setUsageRate(rate(item.getUsed(), item.getLimit()));
        item.setPrecision(precision);
        item.setUpdatedAt(updatedAt);
        item.setQuotaId(quotaId);
        item.setQuotaType(quotaType);
        item.setSource(source);
        return item;
    }

    private static Double rate(Double used, Double limit) {
        if (used == null || limit == null || limit == 0D) {
            return 0D;
        }
        return Math.round(used / limit * 10000D) / 100D;
    }
}
