package com.agri.production.controller;

import com.agri.production.entity.SensorData;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.integration.IotDeviceClient;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IIoTService;
import com.agri.production.service.IotDeviceStatsService;
import com.agri.production.vo.IotDeviceVO;
import org.springframework.web.bind.annotation.*;

import com.agri.production.common.entity.PageResult;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import com.agri.production.service.TenantContextService;

/**
 * IoT 设备台账与传感器读数（{@code /api/v1/production/iot}）。
 *
 * <p><b>设备台账已收敛到物联网系统</b>（2026-10-28）：设备本体（编码/名称/类型/协议/
 * 在线状态/所属农场与地块）统一以 agri-iot 的 {@code iot_device} 为唯一数据源，
 * 生产管理不再维护 {@code agri_prod_iot_device} 这份副本 —— 之前两份数据各走各的，
 * 生产端 13 台、物联网端 16 台，用户在两个系统里看到的根本不是同一批设备。</p>
 *
 * <p>因此设备的新增/编辑/删除也一并收归物联网系统，本控制器只保留
 * <b>查询</b>（列表/详情）和 <b>传感器读数</b>。设备绑定（绑定到地块/大棚/农场）
 * 是生产业务独有的能力，仍在 {@link IotOpsController} 里，绑定时会回写物联网端的
 * {@code plot_id}。</p>
 *
 * <p>2026-10-16 的两处历史改动仍有效：</p>
 * <ol>
 *   <li>设备列表/详情返回页面契约 {@link IotDeviceVO}（不是实体）：页面读的是
 *       deviceId / onlineStatus / lastHeartbeatAt，实体里这三个字段都没有。</li>
 *   <li>{@code {id}} 限定为数字（{@code {id:\d+}}）：平台侧还有 {@code /iot/devices/offline} 这类
 *       <b>字面量路径</b>，被 {@code /devices/{id}} 吃掉后 Long 转换失败 → 400，而网关的 404 回退接不住 400。</li>
 * </ol>
 */
@RestController
@RequestMapping("/api/v1/production/iot")
public class IoTController {

    private final IIoTService ioTService;
    private final FarmIdResolver farmIdResolver;
    private final IotDeviceClient iotDeviceClient;
    private final IotDeviceStatsService iotDeviceStats;

    public IoTController(IIoTService ioTService, FarmIdResolver farmIdResolver,
                         IotDeviceClient iotDeviceClient, IotDeviceStatsService iotDeviceStats) {
        this.ioTService = ioTService;
        this.farmIdResolver = farmIdResolver;
        this.iotDeviceClient = iotDeviceClient;
        this.iotDeviceStats = iotDeviceStats;
    }

    /**
     * 设备列表。
     *
     * <p>数据来自物联网系统（{@code /api/v1/iot/app/devices}）。那个接口返回全量数组、
     * 不支持分页，也认不出生产端这套「设备类型 1~5」的枚举，所以农场过滤、类型过滤和
     * 分页都在这里本地做 —— 设备量是百级，内存处理没有压力。</p>
     */
    @GetMapping("/devices")
    public ApiResponse<PageResult<IotDeviceVO>> listDevices(
            @RequestParam(required = false) String deviceName,
            @RequestParam(required = false) String deviceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String farmId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String tenantId = TenantContextService.currentTenantId();
        // 页面传的是"当前农场"的平台标识（DEMO-FARM-xxx）：不换算的话按农场筛选会静默失效
        Long localFarmId = farmIdResolver.resolveFilter(farmId, tenantId);

        Map<String, Object> query = new java.util.LinkedHashMap<>();
        if (deviceName != null && !deviceName.isBlank()) {
            query.put("keyword", deviceName.trim());
        }
        String iotStatus = iotStatusFilter(status);
        if (iotStatus != null) {
            query.put("status", iotStatus);
        }

        List<Map<String, Object>> all = iotDeviceClient.listDevices(authorization, query);

        List<IotDeviceVO> rows = all.stream()
                .filter(row -> localFarmId == null
                        || String.valueOf(localFarmId).equals(String.valueOf(row.get("farmId"))))
                .map(IotDeviceVO::ofIot)
                .filter(vo -> vo != null)
                .filter(vo -> deviceType == null || deviceType.isBlank()
                        || String.valueOf(vo.getDeviceType()).equals(deviceType.trim()))
                .toList();

        int total = rows.size();
        int from = Math.max(0, (Math.max(pageNum, 1) - 1) * Math.max(pageSize, 1));
        int to = Math.min(total, from + Math.max(pageSize, 1));
        List<IotDeviceVO> pageRows = from >= total ? List.of() : rows.subList(from, to);
        return ApiResponse.success(PageResult.of(pageRows, (long) total, pageNum, pageSize));
    }

    @GetMapping("/devices/{id:\\d+}")
    public ApiResponse<IotDeviceVO> getDevice(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> row = iotDeviceClient.getDevice(authorization, id);
        if (row == null) {
            throw new BusinessException(404, "设备不存在：" + id);
        }
        return ApiResponse.success(IotDeviceVO.ofIot(row));
    }

    /**
     * 设备数量统计（总数 / 在线 / 离线 / 故障）。
     *
     * <p>监控看板、管理端大盘这类"只要数字"的场景用它，而不是拉全量设备列表再 {@code length} ——
     * 后者在设备超过一页时会静默少算，且与物联网端的统计口径（含 alert 单独计数）对不上。</p>
     *
     * @param farmId 农场筛选（接受数字 id / 农场编码 / 平台标识 DEMO-FARM-001），可为空
     */
    @GetMapping("/device-stats")
    public ApiResponse<Map<String, Object>> deviceStats(
            @RequestParam(required = false) String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        Long localFarmId = farmIdResolver.resolveFilter(farmId, tenantId);
        return ApiResponse.success(iotDeviceStats.counts(tenantId, localFarmId));
    }

    /**
     * 生产端「在线状态」枚举 → 物联网端的文本状态。
     *
     * <p>页面是 1 在线 / 2 离线 / 3 故障，物联网端是 online / offline / alert。
     * 认不出的值原样透传，让物联网端自己去报错，而不是静默变成"全部"。</p>
     */
    private static String iotStatusFilter(String status) {
        if (status == null || status.isBlank() || "all".equalsIgnoreCase(status.trim())) {
            return null;
        }
        return switch (status.trim()) {
            case "1" -> "online";
            case "3" -> "alert";
            case "2" -> "offline";
            default -> status.trim();
        };
    }

    @PostMapping("/sensor-data")
    public ApiResponse<Void> saveSensorData(@RequestBody SensorData data) {
        ioTService.saveSensorData(data);
        return ApiResponse.success();
    }

    @GetMapping("/sensor-data/history")
    public ApiResponse<List<SensorData>> getSensorHistory(
            @RequestParam Long deviceId,
            @RequestParam String startTime,
            @RequestParam String endTime) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        LocalDateTime start = LocalDateTime.parse(startTime, formatter);
        LocalDateTime end = LocalDateTime.parse(endTime, formatter);
        List<SensorData> history = ioTService.getSensorHistory(deviceId, start, end);
        return ApiResponse.success(history);
    }

    @PostMapping("/sensor-data/latest")
    public ApiResponse<List<Map<String, Object>>> getLatestData(@RequestBody List<Long> deviceIds) {
        List<Map<String, Object>> latest = ioTService.getLatestData(deviceIds);
        return ApiResponse.success(latest);
    }

    @GetMapping("/sensor-data/statistics")
    public ApiResponse<Map<String, Object>> getDeviceStatistics(
            @RequestParam Long deviceId,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        LocalDateTime start = startTime != null ? LocalDateTime.parse(startTime, formatter) : LocalDateTime.now().minusDays(7);
        LocalDateTime end = endTime != null ? LocalDateTime.parse(endTime, formatter) : LocalDateTime.now();
        Map<String, Object> stats = ioTService.getDeviceStatistics(deviceId, start, end);
        return ApiResponse.success(stats);
    }

    @GetMapping("/statistics")
    public ApiResponse<Map<String, Object>> getIoTStatistics() {
        Map<String, Object> statistics = ioTService.getIoTStatistics(TenantContextService.currentTenantId());
        return ApiResponse.success(statistics);
    }
}
