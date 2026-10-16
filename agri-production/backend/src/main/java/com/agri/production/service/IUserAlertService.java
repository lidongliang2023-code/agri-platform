package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.UserAlertVO;

import java.util.List;
import java.util.Map;

/**
 * 用户端：告警中心（{@code /api/v1/production/alerts} 的记录类端点）。
 *
 * <p><b>只覆盖告警记录这一半</b>：列表 / 未处理 / 统计 / 处置 / 批量忽略。
 * 告警**规则**（{@code /alerts/rules/**}）刻意不接 —— 本服务的规则表列
 * （rule_name / alert_type / level / condition_expression / threshold_min|max / notify_methods）
 * 与页面 {@code AlertRule} 的契约（metric / operator / threshold / duration / scope / notifyChannels）
 * 对不上，硬映射等于编数据；规则继续留在平台侧，与管理端当时的处置一致
 * （管理端也把 {@code /admin/alerts/rules} 留在了平台侧）。</p>
 */
public interface IUserAlertService {

    /** 告警分页（farmId / alertLevel / alertSource / status / keyword / startDate / endDate 均可选）。 */
    PageResult<UserAlertVO> page(int pageNum, int pageSize, String tenantId, String farmId, Integer alertLevel,
                                Integer alertSource, Integer status, String keyword, String startDate, String endDate);

    /** 未处理告警（页面看板的"待处理"清单，按触发时间倒序）。 */
    List<UserAlertVO> unhandled(String tenantId, String farmId);

    /**
     * 告警统计（页面顶部指标卡）。
     *
     * @return total / unhandled / handling / resolved / ignored / levelCounts[{level,count}]
     */
    Map<String, Object> stats(String tenantId, String farmId);

    /**
     * 处置告警：落状态、处置说明与处置时间。
     *
     * @param status 1 未处理 / 2 处理中 / 3 已处理 / 4 已忽略
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 告警不存在（404）
     */
    UserAlertVO handle(String tenantId, String alertId, Integer status, String handleRemark);

    /**
     * 批量忽略。
     *
     * @return 实际被改成"已忽略"的条数（已是忽略态的不计入）
     * @throws com.agri.production.common.exception.BusinessException 空列表或存在查不到的编号（400）
     */
    int ignore(String tenantId, List<String> alertIds);
}
