package com.agri.produce.internal.admin;

import lombok.Data;

/**
 * 批量调整配额的单项结果（与批量绑定同一设计：单条失败不拖垮整批）。
 */
@Data
public class QuotaLimitBatchResult {

    /** 租户标识（配额记录主键或租户编码） */
    private String tenantId;

    /** 是否成功 */
    private boolean success;

    /** 失败原因；成功为 null */
    private String reason;

    /**
     * 构造成功结果。
     *
     * @param tenantId 租户标识
     * @return 结果对象
     */
    public static QuotaLimitBatchResult ok(String tenantId) {
        QuotaLimitBatchResult result = new QuotaLimitBatchResult();
        result.setTenantId(tenantId);
        result.setSuccess(true);
        result.setReason(null);
        return result;
    }

    /**
     * 构造失败结果。
     *
     * @param tenantId 租户标识
     * @param reason   失败原因
     * @return 结果对象
     */
    public static QuotaLimitBatchResult fail(String tenantId, String reason) {
        QuotaLimitBatchResult result = new QuotaLimitBatchResult();
        result.setTenantId(tenantId);
        result.setSuccess(false);
        result.setReason(reason);
        return result;
    }
}
