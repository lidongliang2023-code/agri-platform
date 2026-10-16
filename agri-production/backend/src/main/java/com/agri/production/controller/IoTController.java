package com.agri.production.controller;

import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.SensorData;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IIoTService;
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
 * <p>2026-10-16 的两处改动，都是为了"切流到本服务后页面还能正常用"：</p>
 * <ol>
 *   <li>设备列表/详情改返回页面契约 {@link IotDeviceVO}（原先直接返回实体）：页面读的是
 *       deviceId / onlineStatus / lastHeartbeatAt，而实体里这三个字段都没有 —— 页面上的表现是
 *       "行 id 是 undefined（详情链接拼成 /undefined）、每台设备都判成离线"，接口却是 200，光看接口发现不了。</li>
 *   <li>{@code {id}} 限定为数字（{@code {id:\d+}}）：平台侧还有 {@code /iot/devices/offline} 这类
 *       <b>字面量路径</b>，被 {@code /devices/{id}} 吃掉后 Long 转换失败 → 400，而网关的 404 回退接不住 400。
 *       限定数字后这类路径在本服务没有匹配 → 404 → 网关回退到平台侧（与切流前一致）。</li>
 * </ol>
 */
@RestController
@RequestMapping("/api/v1/production/iot")
public class IoTController {

    private final IIoTService ioTService;
    private final FarmIdResolver farmIdResolver;

    public IoTController(IIoTService ioTService, FarmIdResolver farmIdResolver) {
        this.ioTService = ioTService;
        this.farmIdResolver = farmIdResolver;
    }

    @GetMapping("/devices")
    public ApiResponse<PageResult<IotDeviceVO>> listDevices(
            @RequestParam(required = false) String deviceName,
            @RequestParam(required = false) String deviceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String farmId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        String tenantId = TenantContextService.currentTenantId();
        // 页面传的是"当前农场"的平台标识（DEMO-FARM-xxx）：不换算的话按农场筛选会静默失效
        Long localFarmId = farmIdResolver.resolveFilter(farmId, tenantId);
        PageResult<?> page = ioTService.listDevices(deviceName, deviceType, status, pageNum, pageSize,
                tenantId, localFarmId);
        List<IotDeviceVO> rows = page.getRecords().stream()
                .filter(IoTDevice.class::isInstance)
                .map(IoTDevice.class::cast)
                .map(IotDeviceVO::of)
                .toList();
        return ApiResponse.success(PageResult.of(rows, page.getTotal(), page.getPageNum(), page.getPageSize()));
    }

    @GetMapping("/devices/{id:\\d+}")
    public ApiResponse<IotDeviceVO> getDevice(@PathVariable Long id) {
        IoTDevice device = ioTService.getDeviceById(id);
        if (device == null) {
            throw new BusinessException(404, "设备不存在：" + id);
        }
        return ApiResponse.success(IotDeviceVO.of(device));
    }

    @PostMapping("/devices")
    public ApiResponse<IoTDevice> saveDevice(@RequestBody IoTDevice device) {
        // 设备名称是 NOT NULL 列：不校验就插，空体会直接 500（实测探针打到这条就是 500）。
        // 缺参数应当是 400 —— 500 会让人以为服务坏了。
        if (device == null || device.getDeviceName() == null || device.getDeviceName().isBlank()) {
            throw new BusinessException(400, "设备名称为必填");
        }
        IoTDevice saved = ioTService.saveDevice(device, TenantContextService.currentTenantId());
        return ApiResponse.success(saved);
    }

    /**
     * 编辑设备。
     *
     * <p>入参按**页面字段名**接（deviceName / model / manufacturer / firmwareVersion / location /
     * deviceCode / deviceType），且只改传了的字段：直接把请求体当实体接收的话，页面发的 {@code model}
     * 在实体里叫 {@code deviceModel}，Jackson 认不出就丢掉 —— 表现为"页面提示保存成功、型号没变"。</p>
     */
    @PutMapping("/devices/{id:\\d+}")
    public ApiResponse<IotDeviceVO> updateDevice(@PathVariable Long id,
                                                @RequestBody(required = false) Map<String, Object> body) {
        IoTDevice device = ioTService.getDeviceById(id);
        if (device == null) {
            throw new BusinessException(404, "设备不存在：" + id);
        }
        if (body != null) {
            applyIfPresent(body, "deviceName", device::setDeviceName);
            applyIfPresent(body, "deviceCode", device::setDeviceCode);
            applyIfPresent(body, "model", device::setDeviceModel);
            applyIfPresent(body, "deviceModel", device::setDeviceModel);
            applyIfPresent(body, "manufacturer", device::setManufacturer);
            applyIfPresent(body, "firmwareVersion", device::setFirmwareVersion);
            applyIfPresent(body, "location", device::setLocation);
            applyIfPresent(body, "deviceType", value -> device.setDeviceType(IotDeviceVO.deviceTypeText(value)));
            applyIfPresent(body, "protocol", device::setProtocol);
        }
        IoTDevice saved = ioTService.saveDevice(device, TenantContextService.currentTenantId());
        return ApiResponse.success(IotDeviceVO.of(saved));
    }

    @DeleteMapping("/devices/{id:\\d+}")
    public ApiResponse<Void> deleteDevice(@PathVariable Long id) {
        ioTService.deleteDevice(id);
        return ApiResponse.success();
    }

    @PostMapping("/devices/{id:\\d+}/enable")
    public ApiResponse<Void> enableDevice(@PathVariable Long id, @RequestParam boolean enable) {
        ioTService.enableDevice(id, enable);
        return ApiResponse.success();
    }

    @PostMapping("/devices/{id:\\d+}/status")
    public ApiResponse<Void> updateDeviceStatus(@PathVariable Long id, @RequestParam String status) {
        ioTService.updateDeviceStatus(id, status);
        return ApiResponse.success();
    }

    /** 只在该键存在且非空时套用（避免页面只发部分字段时把其它列刷成 null）。 */
    private static void applyIfPresent(Map<String, Object> body, String key,
                                       java.util.function.Consumer<String> setter) {
        if (!body.containsKey(key)) {
            return;
        }
        Object raw = body.get(key);
        if (raw == null) {
            return;
        }
        String text = String.valueOf(raw).trim();
        if (!text.isEmpty()) {
            setter.accept(text);
        }
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
