package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AdminAlertReviewVO;
import com.agri.production.vo.AdminEmergencyPlanVO;

import java.util.Map;

/**
 * 运营端异常告警（/api/v1/production/admin/alerts 的「关闭告警 / 应急预案 / 灾害复盘」三块）。
 *
 * <p>同一口径：**不做租户过滤**、不调 TenantContextService（理由见 {@link IAdminTraceService}）。</p>
 *
 * <p>注：{@code /admin/alerts} 下的告警列表、规则分页、派单、统计等路径由**平台侧**继续服务
 * （本服务不实现，网关的 404 回退会兜住）；这里只实现前端页面真的在调、而两边都没有实现的那几条。</p>
 */
public interface IAdminAlertService {

    /**
     * 告警列表分页（运营端「告警中心」页面走这条）。
     *
     * <p>形状与 {@link #pageReviews} 一致（同一套 AlertVO 视图）：页面两处都按 alertId / alertTitle /
     * alertLevel(数字) 之类的字段取值，形状不一致就会有一处取到 undefined。</p>
     *
     * @param status     处置状态（1 未处理 / 2 处理中 / 3 已处理 / 4 已忽略），可空
     * @param alertLevel 告警级别（1 提示 / 2 一般 / 3 重要 / 4 紧急），可空
     */
    PageResult<AdminAlertReviewVO> pageAlerts(int pageNum, int pageSize, Integer status, Integer alertLevel);

    /**
     * 关闭告警。
     *
     * @param operator     操作人（可空）
     * @param closeRemark  关闭说明（可空，落了就写进处理结果）
     * @throws com.agri.production.common.exception.BusinessException 告警不存在（404）
     */
    Map<String, Object> closeAlert(Long alertId, String operator, String closeRemark);

    /** 应急预案分页（可按适用告警类型/状态筛）。 */
    PageResult<AdminEmergencyPlanVO> pagePlans(int pageNum, int pageSize, String alertType, Integer status);

    /** 新建应急预案。 */
    AdminEmergencyPlanVO createPlan(Map<String, Object> payload);

    /** 更新应急预案（只改传了的字段）。 */
    AdminEmergencyPlanVO updatePlan(Long planId, Map<String, Object> payload);

    /**
     * 灾害复盘分页 —— 数据源是**已处置告警**（页面的行模型 {@code AlertReviewItem} 只认 alertId）。
     *
     * @param disasterType 页面上的"灾害类型"筛选：后端没有该字段，这里忽略（页面自己会提示「未接入」）
     */
    PageResult<AdminAlertReviewVO> pageReviews(int pageNum, int pageSize, String disasterType);

    /**
     * 保存复盘信息 —— 页面传的是 {@code {handleProcess: 处置说明}}，
     * 落到该告警的处置结果（页面读回来就是 handleRemark）。
     */
    AdminAlertReviewVO updateReview(Long alertId, Map<String, Object> payload);

    /**
     * 新增复盘：**明确不支持**。
     *
     * <p>页面有个"新增事件复盘"表单（事件名称/灾害类型/受灾面积/经济损失/改进措施），
     * 但这一页的**列表数据源是已处置告警** —— 就算把表单存进一张独立表，它也永远不会出现在列表里，
     * 用户会看到"创建成功、列表没变化"。所以这里如实拒绝并说明原因，而不是造一张没人看得见的表。</p>
     */
    AdminAlertReviewVO createReview(Map<String, Object> payload);
}
