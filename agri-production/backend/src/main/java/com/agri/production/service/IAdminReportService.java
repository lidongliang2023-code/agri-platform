package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.FarmComplianceCheck;
import com.agri.production.entity.ReportTask;

import java.util.List;
import java.util.Map;

/**
 * 运营端「统计报表」与「农场监管-合规检查」（/admin/reports 与 /admin/farms）。
 *
 * <p>同一口径：不做租户过滤、不调 TenantContextService（理由见 {@link IAdminTraceService}）。</p>
 */
public interface IAdminReportService {

    /** 报表台账分页（keyword 匹配报表名/编号，status 可筛）。 */
    PageResult<ReportTask> pageReports(int pageNum, int pageSize, String keyword, String status);

    /** 新建报表任务，返回报表编号。 */
    String createReport(Map<String, Object> payload);

    /** 按类型列出（GOV / QUALITY）。 */
    List<ReportTask> listByType(String reportType);

    /**
     * 报表中心统计：{@code totalCount / monthCount / downloadCount / failedCount}。
     *
     * <p>⚠️ {@code downloadCount} 恒为 0 且**不是统计值**：本服务没有下载流水表
     * （页面的导出动作也不经过后端），所以"下载次数"没有任何数据来源。
     * 这一点写在返回里没有意义（契约是数字），因此写在这里、也写在页面的口径说明里。</p>
     */
    Map<String, Object> reportStat();

    /** 合规检查台账分页（farmId / result 可筛）。 */
    PageResult<FarmComplianceCheck> pageComplianceChecks(int pageNum, int pageSize, Long farmId, Integer result);

    /** 单农场合规画像。 */
    Map<String, Object> farmComplianceProfile(Long farmId);

    /** 更新合规检查（录入结果 / 整改跟踪）：只改传了的字段。 */
    FarmComplianceCheck updateComplianceCheck(String checkId, Map<String, Object> patch);
}
