package com.agri.iot.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 物联网子系统 - AI能力中台集成适配器
 * 负责接收传感器异常数据流，调用 AI 中台进行故障分析与联动控制推演
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/iot/ai")
public class IotAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public IotAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 传感器时序异常研判与滤波分析
     */
    @PostMapping("/anomaly-diagnosis")
    public ApiResponse<AiInvokeResponse> diagnoseDeviceAnomaly(@RequestBody Map<String, Object> params) {
        String deviceId = String.valueOf(params.getOrDefault("deviceId", "dev-sensor-001"));
        log.info("[IOT-AI] 触发设备时序异常诊断: deviceId={}", deviceId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("iot.device.anomaly")
                .bizSystem("iot_sensor")
                .bizId(deviceId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("传感器异常诊断分析完成", response);
    }

    /**
     * 设施农业微气候调控策略推演
     */
    @PostMapping("/env-strategy")
    public ApiResponse<AiInvokeResponse> calculateEnvStrategy(@RequestBody Map<String, Object> params) {
        String greenhouseId = String.valueOf(params.getOrDefault("greenhouseId", "gh-zone-004"));
        log.info("[IOT-AI] 触发温室调控策略推演: greenhouseId={}", greenhouseId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("iot.env.strategy")
                .bizSystem("iot_sensor")
                .bizId(greenhouseId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("温室联动调控策略推演完成", response);
    }
}
