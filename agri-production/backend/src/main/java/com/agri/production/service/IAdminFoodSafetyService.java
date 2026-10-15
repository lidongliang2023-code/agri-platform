package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AdminFsAlertVO;
import com.agri.production.vo.AdminFsCirculationVO;
import com.agri.production.vo.AdminFsFarmRiskVO;

import java.util.List;
import java.util.Map;

/**
 * 运营端食品安全（/api/v1/production/admin/food-safety）。
 *
 * <p>本服务只做**运营端**这一侧；食品安全的表由 schema-patch-food-safety.sql 建立
 * （11 张表，DDL 由平台侧机械转换而来），演示数据按子域分批迁移。</p>
 *
 * <p>同一口径：不做租户过滤、不调 TenantContextService（理由见 {@link IAdminTraceService}）。</p>
 */
public interface IAdminFoodSafetyService {

    /** 食品安全告警列表（按发生时间倒序，limit 上限保护）。 */
    List<AdminFsAlertVO> listAlerts(int limit);

    /**
     * 处置食品安全告警：落处置措施 + 处置说明，状态置"已处理"。
     *
     * @throws com.agri.production.common.exception.BusinessException 告警不存在（404）
     */
    AdminFsAlertVO handleAlert(String alertId, String measure, String remark);

    /** 流通异常分页（type / severity / date / keyword 均可选）。 */
    PageResult<AdminFsCirculationVO> pageCirculation(int pageNum, int pageSize, String type, String severity,
                                                    String date, String keyword);

    /**
     * 处理流通异常：落处置方式与说明，状态置"已处理"。
     *
     * @throws com.agri.production.common.exception.BusinessException 异常记录不存在（404）
     */
    AdminFsCirculationVO handleCirculation(String anomalyId, String action, String remark);

    /** 当期农场风险评分（按分数降序，页面取前若干条画热力图）。 */
    List<AdminFsFarmRiskVO> riskDistribution();

    /**
     * 监控中心指标：{@code safetyIndex / safetyIndexDelta / passRate / passRateDelta /
     * alertCount / urgentAlertCount / compliancePassRate / coldChainPassRate}。
     *
     * <p>口径（与平台侧 AdminFoodSafetyMonitorService 一致）：</p>
     * <ul>
     *   <li>{@code safetyIndex} / {@code safetyIndexDelta}：当期与上期农场风险评分均值，及环比；</li>
     *   <li>{@code passRate} / {@code passRateDelta}：当期与上期**校验项**合格占比，及环比（合规子域已接入，故为真算）；</li>
     *   <li>{@code compliancePassRate}：全部标准 {@code pass_count / batch_count}（批次级，与 P17 Tab3 同源）；</li>
     *   <li>{@code coldChainPassRate}：冷链资源非离线占比 —— <b>冷链子域尚未接入，当前恒为占位的 0</b>，
     *       不是"达标率 0%"；接入 P19 那一批端点时一并改成真算。</li>
     * </ul>
     *
     * <p>凡是没有数据源的分项一律不给"看起来合理"的数：能算的算，算不了的给 null（页面渲染「—」）。</p>
     */
    Map<String, Object> metrics();
}
