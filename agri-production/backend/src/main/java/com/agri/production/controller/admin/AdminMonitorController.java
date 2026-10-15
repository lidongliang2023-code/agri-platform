package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IAdminMonitorService;
import com.agri.production.vo.AdminMonitorAlertVO;
import com.agri.production.vo.AdminMonitorDeviceVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：生产监控（{@code /api/v1/production/admin/monitor}）。
 *
 * <p>按前端契约 {@code api/admin/monitor.ts} 里**页面真的在调**的六条实现：
 * 监测总览 / 设备状态清单 / 实时告警流 / 任务状态聚合 / 催办任务 / 下发重启指令。
 * 对应页面是 {@code admin/monitor/{MonitorCenter,IotMonitor,TaskMonitor}}。</p>
 *
 * <p>不做租户过滤（运营端看全局），理由见 {@link com.agri.production.service.IAdminTraceService}。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/monitor")
public class AdminMonitorController {

    private final IAdminMonitorService adminMonitorService;

    public AdminMonitorController(IAdminMonitorService adminMonitorService) {
        this.adminMonitorService = adminMonitorService;
    }

    /** 监测总览（MonitorCenter 走这条）。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(adminMonitorService.overview());
    }

    /** 设备运行状态清单（IotMonitor 走这条；onlineOnly=true 只看在线）。 */
    @GetMapping("/devices")
    public ApiResponse<List<AdminMonitorDeviceVO>> devices(
            @RequestParam(defaultValue = "false") boolean onlineOnly) {
        return ApiResponse.success(adminMonitorService.devices(onlineOnly));
    }

    /** 实时告警流（MonitorCenter 走这条，默认近 60 分钟）。 */
    @GetMapping("/alerts")
    public ApiResponse<List<AdminMonitorAlertVO>> alerts(@RequestParam(defaultValue = "60") int minutes) {
        return ApiResponse.success(adminMonitorService.realtimeAlerts(minutes));
    }

    /** 任务状态聚合（MonitorCenter 走这条）。 */
    @GetMapping("/tasks")
    public ApiResponse<List<Map<String, Object>>> tasks() {
        return ApiResponse.success(adminMonitorService.taskStatusStats());
    }

    /** 催办任务（TaskMonitor 走这条）。 */
    @PatchMapping("/tasks/{taskId}/urge")
    public ApiResponse<Map<String, Object>> urge(@PathVariable Long taskId,
                                                @RequestParam(required = false) String operator) {
        return ApiResponse.success(adminMonitorService.urgeTask(taskId, operator));
    }

    /**
     * 下发设备重启指令（IotMonitor 走这条）。
     *
     * <p>本部署没有设备网关：这里只把指令记下来（页面文案即"重启指令已下发"），
     * 不会真去重启设备。</p>
     */
    @PatchMapping("/iot/{deviceId}/reboot")
    public ApiResponse<Map<String, Object>> reboot(@PathVariable Long deviceId,
                                                  @RequestParam(required = false) String operator) {
        return ApiResponse.success(adminMonitorService.requestReboot(deviceId, operator));
    }
}
