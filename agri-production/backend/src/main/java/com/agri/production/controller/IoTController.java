package com.agri.production.controller;

import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.SensorData;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IIoTService;
import org.springframework.web.bind.annotation.*;

import com.agri.production.common.entity.PageResult;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/iot")
public class IoTController {

    private final IIoTService ioTService;

    public IoTController(IIoTService ioTService) {
        this.ioTService = ioTService;
    }

    @GetMapping("/devices")
    public ApiResponse<PageResult<?>> listDevices(
            @RequestParam(required = false) String deviceName,
            @RequestParam(required = false) String deviceType,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return ApiResponse.success(ioTService.listDevices(deviceName, deviceType, status, pageNum, pageSize, "T001"));
    }

    @GetMapping("/devices/{id}")
    public ApiResponse<IoTDevice> getDevice(@PathVariable Long id) {
        IoTDevice device = ioTService.getDeviceById(id);
        return ApiResponse.success(device);
    }

    @PostMapping("/devices")
    public ApiResponse<IoTDevice> saveDevice(@RequestBody IoTDevice device) {
        IoTDevice saved = ioTService.saveDevice(device, "T001");
        return ApiResponse.success(saved);
    }

    @PutMapping("/devices/{id}")
    public ApiResponse<IoTDevice> updateDevice(@PathVariable Long id, @RequestBody IoTDevice device) {
        device.setId(id);
        IoTDevice saved = ioTService.saveDevice(device, "T001");
        return ApiResponse.success(saved);
    }

    @DeleteMapping("/devices/{id}")
    public ApiResponse<Void> deleteDevice(@PathVariable Long id) {
        ioTService.deleteDevice(id);
        return ApiResponse.success();
    }

    @PostMapping("/devices/{id}/enable")
    public ApiResponse<Void> enableDevice(@PathVariable Long id, @RequestParam boolean enable) {
        ioTService.enableDevice(id, enable);
        return ApiResponse.success();
    }

    @PostMapping("/devices/{id}/status")
    public ApiResponse<Void> updateDeviceStatus(@PathVariable Long id, @RequestParam String status) {
        ioTService.updateDeviceStatus(id, status);
        return ApiResponse.success();
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
        Map<String, Object> statistics = ioTService.getIoTStatistics("T001");
        return ApiResponse.success(statistics);
    }
}