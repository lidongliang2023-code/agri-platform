package com.agri.production.service;

import java.util.List;
import java.util.Map;

/**
 * 运营端仪表盘（/api/v1/production/admin/dashboard）。
 *
 * <p>六条聚合全部按**本服务的表**重写（平台侧那份 27KB 的 AdminDashboardService 是按 agri_core
 * 的表写的，字段与主键口径都不同）。每个聚合的数据来源与近似写在实现类的注释里 ——
 * 仪表盘最容易悄悄编数，所以这里的规矩是：**能算的算，算不出的给 0 或 null，并写明口径**。</p>
 *
 * <p>同一口径：不做租户过滤、不调 TenantContextService（理由见 {@link IAdminTraceService}）。</p>
 */
public interface IAdminDashboardService {

    /**
     * 汇总指标：{@code farmCount / fieldArea / outputTon / taskRate / alertCount}
     * —— 页面就是按这五个键取值的（见 OpsProductionOverview 的 pick()）。
     */
    Map<String, Object> overview(String startDate, String endDate);

    /**
     * 多维度明细。
     *
     * @param dimension region 按省 / crop 按作物 / tenant 按租户
     */
    List<Map<String, Object>> overviewRows(String dimension, String startDate, String endDate, String region);

    /** 种植面积排行（TOP N 农场）：{@code farmId / farmName / areaTotal / plotCount}。 */
    List<Map<String, Object>> rank(int limit);

    /** 区域分布：{@code region / farmCount / fieldArea / tenantCount / activityLevel}。 */
    List<Map<String, Object>> regionDistribution(String startDate, String endDate);

    /** 告警级别分布：级别 → 数量（键就是库里的级别值，页面两套词表都认）。 */
    Map<String, Object> alertTrend();

    /** 近 7 天趋势：{@code label / taskRate / activeWorkers / alertCount}。 */
    List<Map<String, Object>> trend(String startDate, String endDate);
}
