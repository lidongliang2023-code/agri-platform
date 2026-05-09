package com.agri.production.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

@FeignClient(name = "iot", url = "${services.iot.url}")
public interface IotFeignClient {

    @GetMapping("/api/iot/device/{id}")
    Map<String, Object> getDeviceById(@PathVariable Long id);

    @GetMapping("/api/iot/device/list")
    Map<String, Object> getDeviceList(@RequestParam(required = false) Long gatewayId);

    @GetMapping("/api/iot/device/data/realtime")
    Map<String, Object> getRealtimeData(@RequestParam Long deviceId);

    @GetMapping("/api/iot/device/data/history")
    Map<String, Object> getHistoryData(
            @RequestParam Long deviceId,
            @RequestParam String startTime,
            @RequestParam String endTime);

    @GetMapping("/api/iot/plot/{id}")
    Map<String, Object> getPlotById(@PathVariable Long id);

    @GetMapping("/api/iot/alert/list")
    Map<String, Object> getAlertList(
            @RequestParam(required = false) Long deviceId,
            @RequestParam(required = false) String status);

    @GetMapping("/api/iot/gateway/{id}")
    Map<String, Object> getGatewayById(@PathVariable Long id);

    @GetMapping("/api/iot/scene/{id}")
    Map<String, Object> getSceneById(@PathVariable Long id);
}