package com.agri.production.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 生产管理系统 - AI能力中台集成适配器
 * 负责接收种植批次参数，调用 AI 中台统一调度接口，返回标准化排程并推进农事计划
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/production/ai")
public class FarmAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public FarmAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 作物物候智能农事排程推荐
     */
    @PostMapping("/crop-schedule")
    public ApiResponse<AiInvokeResponse> generateCropSchedule(@RequestBody Map<String, Object> params) {
        String batchId = String.valueOf(params.getOrDefault("batchId", "batch-default-001"));
        log.info("[PRODUCTION-AI] 触发生产批次智能排程: batchId={}", batchId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("farm.crop.schedule")
                .bizSystem("farm_prod")
                .bizId(batchId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        // 业务层将 response.getResult() 结构化存储落库至农事计划表
        return ApiResponse.success("智能农事排程生成成功", response);
    }

    /**
     * 智能植保与病虫害诊断推荐
     */
    @PostMapping("/pest-diagnosis")
    public ApiResponse<AiInvokeResponse> diagnosePest(@RequestBody Map<String, Object> params) {
        String inspectId = String.valueOf(params.getOrDefault("inspectId", "insp-" + System.currentTimeMillis()));
        log.info("[PRODUCTION-AI] 触发田间巡检智能诊断: inspectId={}", inspectId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("farm.pest.diagnosis")
                .bizSystem("farm_prod")
                .bizId(inspectId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("病害智能诊断完成", response);
    }
}
