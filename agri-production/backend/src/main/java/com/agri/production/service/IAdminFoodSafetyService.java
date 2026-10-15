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
     * <p>依赖合规抽查与冷链两组表（子域先后迁移），在它们到位之前，涉及的分项会以
     * 0 或 null 如实返回，不填看起来合理的假数。</p>
     */
    Map<String, Object> metrics();
}
