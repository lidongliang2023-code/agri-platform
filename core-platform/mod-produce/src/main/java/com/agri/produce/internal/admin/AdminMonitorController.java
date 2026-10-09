package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.iot.IotDeviceEntity;
import com.agri.produce.internal.iot.IotReadingEntity;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：实时监测（/api/v1/production/admin/monitor）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/monitor")
@RequiredArgsConstructor
public class AdminMonitorController {

    private final AdminMonitorService adminMonitorService;

    /** 监测总览 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(adminMonitorService.overview());
    }

    /** 设备运行状态 */
    @GetMapping("/devices")
    public ApiResponse<List<IotDeviceEntity>> devices(@RequestParam(defaultValue = "false") boolean onlineOnly) {
        return ApiResponse.ok(adminMonitorService.devices(onlineOnly));
    }

    /** 实时告警流 */
    @GetMapping("/alerts")
    public ApiResponse<List<AlertInfoEntity>> alerts(@RequestParam(defaultValue = "60") int minutes) {
        return ApiResponse.ok(adminMonitorService.realtime(minutes));
    }

    /** 设备最新读数 */
    @GetMapping("/readings/latest")
    public ApiResponse<IotReadingEntity> latestReading(@RequestParam String deviceId) {
        return ApiResponse.ok(adminMonitorService.latestReading(deviceId));
    }

    /** 任务监控 */
    @GetMapping("/tasks")
    public ApiResponse<List<Map<String, Object>>> tasks() {
        return ApiResponse.ok(adminMonitorService.taskMonitor());
    }

    /** IoT 监控 */
    @GetMapping("/iot")
    public ApiResponse<Map<String, Object>> iot() {
        return ApiResponse.ok(adminMonitorService.overview());
    }

    /** 投入品监控 */
    @GetMapping("/inputs")
    public ApiResponse<List<Map<String, Object>>> inputs() {
        return ApiResponse.ok(adminMonitorService.inputMonitor());
    }
}
