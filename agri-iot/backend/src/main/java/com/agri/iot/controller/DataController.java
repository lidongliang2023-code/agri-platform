package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.entity.DeviceData;
import com.agri.iot.service.IDeviceDataService;
import com.agri.iot.vo.DeviceDataVO;
import com.agri.iot.vo.RealtimeDataVO;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/iot/data")
@RequiredArgsConstructor
public class DataController {

    private final IDeviceDataService deviceDataService;

    @GetMapping("/history")
    public ApiResponse<PageResult<DeviceDataVO>> getHistory(
            @RequestParam Long deviceId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        return ApiResponse.success(deviceDataService.getHistory(deviceId, startTime, endTime, pageNum, pageSize));
    }

    @GetMapping("/realtime/{deviceId}")
    public ApiResponse<RealtimeDataVO> getRealtime(@PathVariable Long deviceId) {
        return ApiResponse.success(deviceDataService.getRealtime(deviceId));
    }

    @GetMapping("/plot/{plotId}/realtime")
    public ApiResponse<List<RealtimeDataVO>> getPlotRealtime(@PathVariable Long plotId) {
        return ApiResponse.success(deviceDataService.getPlotRealtime(plotId));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody DeviceData data) {
        deviceDataService.save(data);
        return ApiResponse.success();
    }
}