package com.agri.produce.internal.admin;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;

/**
 * 运营端「租户概览」：平台级汇总卡片 + 逐租户明细行。
 *
 * <p>统计口径（全部按 {@code tenant_id} 维度聚合，行级隔离由 TenantLineInnerInterceptor 自动
 * 追加 {@code market_id} 条件，SQL 里不再手写）：
 * <ul>
 *     <li>{@code tenantTotal}：出现过的租户数（配额表 ∪ 业务表中有数据的租户）；</li>
 *     <li>{@code deviceOnlineCount}：{@code online_flag = 1} 且最后心跳在
 *         {@link com.agri.produce.internal.iot.IotDeviceService#HEARTBEAT_VALID_MINUTES} 分钟内，
 *         与 {@code /iot/devices?runStatus=ONLINE} 完全一致；</li>
 *     <li>{@code pendingAlertCount}：{@code prod_alert_info.status = 'PENDING'}；</li>
 *     <li>{@code growingPlanCount}：种养计划状态属于
 *         {@link com.agri.produce.internal.plan.PlanInfoService#GROWING_STATUSES}；</li>
 *     <li>{@code quotaWarningCount}：农场配额使用率达到
 *         {@link TenantOverviewService#WARNING_USAGE_RATE} 的租户数。</li>
 * </ul>
 *
 * <p>说明：概览是只读聚合，不落库、不发事件，因此不引入新的表，也不需要新的 Flyway 脚本。
 */
@Data
public class TenantOverview {

    /**
     * 租户总数。
     *
     * <p>说明：所有计数字段用 {@code int} 而非 {@code long} —— JacksonConfig 全局把
     * {@code Long} 序列化成字符串（防 JS 精度丢失），概览计数要参与前端排序与四则运算，
     * 必须是数字。租户级计数不会超过 int 上限。
     */
    private int tenantTotal;

    /** 正常租户数（配额 status = 1） */
    private int activeTenantCount;

    /** 停用租户数（配额 status = 0） */
    private int disabledTenantCount;

    /** 未登记配额但有业务数据的租户数 */
    private int unregisteredTenantCount;

    /** 农场总数 */
    private int farmTotal;

    /** 地块总数 */
    private int plotTotal;

    /** IoT 设备总数 */
    private int deviceTotal;

    /** 在线设备数 */
    private int deviceOnlineCount;

    /** 待处理告警数 */
    private int pendingAlertCount;

    /** 在种计划数 */
    private int growingPlanCount;

    /** 配额告警租户数 */
    private int quotaWarningCount;

    /** 逐租户明细（按农场数倒序，保证前端列表稳定） */
    private List<TenantOverviewRow> rows = new ArrayList<>();
}
