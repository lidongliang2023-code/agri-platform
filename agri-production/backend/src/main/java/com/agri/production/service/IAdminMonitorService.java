package com.agri.production.service;

import com.agri.production.vo.AdminMonitorAlertVO;
import com.agri.production.vo.AdminMonitorDeviceVO;

import java.util.List;
import java.util.Map;

/**
 * 运营端生产监控（/api/v1/production/admin/monitor）。
 *
 * <p>与其它运营端服务同一口径：**不做租户过滤**、不调 TenantContextService
 * （理由见 {@link IAdminTraceService} 的类注释）。</p>
 */
public interface IAdminMonitorService {

    /** 监测总览：设备总数 / 在线数 / 在线率 / 待处理告警数 / 启用规则数。 */
    Map<String, Object> overview();

    /** 设备运行状态清单（onlineOnly=true 只给在线设备）。 */
    List<AdminMonitorDeviceVO> devices(boolean onlineOnly);

    /** 实时告警流（近 minutes 分钟）。 */
    List<AdminMonitorAlertVO> realtimeAlerts(int minutes);

    /**
     * 任务状态聚合。
     *
     * <p>键固定为 pending / assigned / doing / done / rejected —— 页面（MonitorCenter）的筛选项
     * 与"待处理异常数"都按这几个键取值，改键会让它在不动的前提下静默归零。</p>
     */
    List<Map<String, Object>> taskStatusStats();

    /**
     * 催办任务：累加催办次数并记录最近一次催办时间/人。
     *
     * @throws com.agri.production.common.exception.BusinessException 任务不存在（404）
     */
    Map<String, Object> urgeTask(Long taskId, String operator);

    /**
     * 下发设备重启指令：记录指令下发时间。
     *
     * <p><b>本部署没有设备网关</b>，这里做的是"把这条指令记下来"（页面文案即"重启指令已下发"），
     * 不会真去重启设备 —— 不假装设备已经重启。</p>
     *
     * @throws com.agri.production.common.exception.BusinessException 设备不存在（404）
     */
    Map<String, Object> requestReboot(Long deviceId, String operator);
}
