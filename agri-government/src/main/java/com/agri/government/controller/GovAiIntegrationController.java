package com.agri.government.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 政府监管子系统 - AI能力中台集成适配器
 * 负责调用 AI 中台进行产区保供稳价宏观研判与农产品质量安全红线预警
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/government/ai")
public class GovAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public GovAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 区域农产品保供稳价宏观态势研判
     */
    @PostMapping("/market-monitor")
    public ApiResponse<AiInvokeResponse> analyzeMarketSupply(@RequestBody Map<String, Object> params) {
        String regionCode = String.valueOf(params.getOrDefault("regionCode", "350600"));
        log.info("[GOV-AI] 触发区域产销保供稳价研判: regionCode={}", regionCode);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("gov.market.monitor")
                .bizSystem("gov_supervise")
                .bizId(regionCode)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("保供稳价宏观分析完成", response);
    }

    /**
     * 质量安全与农残间隔期红线预警
     */
    @PostMapping("/safety-alert")
    public ApiResponse<AiInvokeResponse> inspectSafetyAlert(@RequestBody Map<String, Object> params) {
        String batchNo = String.valueOf(params.getOrDefault("batchNo", "QC-2026-B891"));
        log.info("[GOV-AI] 触发全域质量安全红线审查: batchNo={}", batchNo);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("gov.safety.alert")
                .bizSystem("gov_supervise")
                .bizId(batchNo)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("质量安全审查预警完成", response);
    }
}
