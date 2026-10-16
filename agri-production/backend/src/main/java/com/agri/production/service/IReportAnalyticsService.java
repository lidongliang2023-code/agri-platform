package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.DimensionPointVO;
import com.agri.production.vo.MetricTrendPointVO;
import com.agri.production.vo.ReportSubscriptionVO;
import com.agri.production.vo.ReportVO;

import java.util.List;
import java.util.Map;

/**
 * 用户端：数据分析与报表（{@code /api/v1/production/analytics}）。
 *
 * <p>与同域其它用户端服务同口径：租户由控制器从 {@link TenantContextService} 取后传入。
 * 农场筛选值由控制器用 {@link FarmIdResolver} 换算成本地主键。</p>
 */
public interface IReportAnalyticsService {

    /**
     * 看板指标（扁平 Map，键与前端 buildOverview 的候选键一致）。
     *
     * <p><b>为什么日期区间不裁这些卡片</b>：页面上的标签是「累计产量」「本月采收量」这类**自带口径**的
     * 说法，若跟着用户在页面右上角选的 30 天窗口变，"累计"二字就名不副实。区间只作用于
     * {@link #trend} 与 {@link #dimension} —— 返回值里带 {@code window.appliedTo} 把这件事说清楚，
     * 免得调用方以为传了区间就全都被裁过。</p>
     *
     * @param farmId    本服务农场主键，可为空
     * @param startDate 区间起（仅回显在 window 里），可为空
     * @param endDate   区间止（仅回显在 window 里），可为空
     */
    Map<String, Object> dashboard(String tenantId, Long farmId, String startDate, String endDate);

    /**
     * 多维度分析（crop 按作物 / plot 按地块 / month 按月份）。
     *
     * @param dimension crop / plot / month
     * @param farmId    本服务农场主键，可为空
     * @param startDate 统计区间起（按采收日期 / 任务计划开始时间），可为空
     * @param endDate   统计区间止，可为空
     */
    List<DimensionPointVO> dimension(String tenantId, Long farmId, String dimension,
                                     String startDate, String endDate);

    /**
     * 指标趋势（按日聚合）。
     *
     * @param metricCode YIELD（采收量）/ PASS_RATE（检测合格率）；为空时按 YIELD
     * @throws com.agri.production.common.exception.BusinessException 指标码不认识（400）
     */
    List<MetricTrendPointVO> trend(String tenantId, Long farmId, String metricCode,
                                   String startDate, String endDate);

    /** 报表分页（period 参数按页面口径做关键字匹配：报表名或周期标签）。 */
    PageResult<ReportVO> pageReports(String tenantId, int pageNum, int pageSize,
                                     Integer reportType, String period);

    /**
     * 生成报表：**即时聚合落库快照**（不是异步任务），status 落库即 2。
     *
     * @param reportType 1~5
     * @param period     周期入参（页面给的是区间起始日期 yyyy-MM-dd）
     * @param farmId     本服务农场主键，可为空
     * @param generatedBy 生成人（当前为空，见 {@link ReportVO} 说明）
     * @throws com.agri.production.common.exception.BusinessException 类型/周期非法（400）
     */
    ReportVO generate(String tenantId, Long farmId, Integer reportType, String period, String generatedBy);

    /**
     * 导出报表：把聚合快照落成 CSV 文件并返回可访问地址。
     *
     * @return fileUrl（带下载令牌，见 DDL 注释）+ fileSize + fileName
     */
    Map<String, Object> export(String tenantId, String reportId);

    /**
     * 下载报表文件（**免 Authorization**：window.open 带不了请求头，靠令牌校验）。
     *
     * @param reportId 报表编号
     * @param key      下载令牌
     * @throws com.agri.production.common.exception.BusinessException 报表不存在或令牌不符（404/403）
     */
    ReportFile download(String reportId, String key);

    /** 删除报表（逻辑删除）。 */
    void deleteReport(String tenantId, String reportId);

    /**
     * 新增订阅。
     *
     * <p>只落库，**不写真投递**：返回体里 delivery = not-configured。</p>
     */
    ReportSubscriptionVO subscribe(String tenantId, Long farmId, SubscriptionPayload payload);

    /** 订阅列表（按更新时间倒序）。 */
    List<ReportSubscriptionVO> listSubscriptions(String tenantId);

    /** 取消订阅（逻辑删除）。 */
    void unsubscribe(String tenantId, String subscribeId);

    /**
     * 订阅入参（页面按自己的字段名发送）。
     *
     * @param reportType 报表类型 1~5
     * @param period     daily / weekly / monthly / quarterly
     * @param channels   接收渠道编码
     * @param receivers  接收人（可多个）
     * @param status     1 启用 0 停用
     */
    record SubscriptionPayload(Integer reportType, String period, List<Integer> channels,
                               List<String> receivers, Integer status) {
    }

    /**
     * 待下载的报表文件。
     *
     * @param fileName 下载文件名
     * @param content  文件内容
     */
    record ReportFile(String fileName, byte[] content) {
    }
}
