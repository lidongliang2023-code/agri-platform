package com.agri.produce.internal.admin;

import java.math.BigDecimal;
import lombok.Data;

/**
 * 运营端「租户概览」的单租户明细行。
 *
 * <p>所有计数字段缺省为 {@code 0}（而非 {@code null}），前端可直接参与排序与四则运算，
 * 不会出现 {@code NaN}。
 */
@Data
public class TenantOverviewRow {

    /** 租户 ID（prod_tenant_quota.tenant_id，SaaS 预留列） */
    private Long tenantId;

    /** 租户编码，未登记配额时为 {@code TENANT-<id>} */
    private String tenantCode;

    /** 租户名称，未登记配额时为「未登记租户」 */
    private String tenantName;

    /** 配额状态：1 正常 / 0 停用 / null 未登记 */
    private Integer status;

    /** 是否已在配额表登记 */
    private boolean registered;

    /** 农场数（按 prod_farm_info 实算） */
    private int farmCount;

    /** 地块数（按 prod_plot_info 实算） */
    private int plotCount;

    /** IoT 设备数 */
    private int deviceCount;

    /** 在线设备数（online_flag=1 且心跳有效） */
    private int deviceOnlineCount;

    /** 待处理告警数 */
    private int pendingAlertCount;

    /** 在种计划数 */
    private int growingPlanCount;

    /** 农场数上限，未配置时为 null */
    private Integer farmLimit;

    /** 农场配额使用率（百分比，保留 2 位；无限额或缺数据时为 0） */
    private BigDecimal farmUsageRate = BigDecimal.ZERO;

    /** 是否触发配额告警（使用率 ≥ 阈值） */
    private boolean quotaWarning;
}
