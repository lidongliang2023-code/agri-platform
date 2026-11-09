package com.agri.service.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 综合服务与客商运营 - AI能力中台集成适配器
 * 负责调用 AI 中台进行对外智能农业顾问交互与客户商机意向分流
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/service/ai")
public class ServiceAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public ServiceAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 产业互联网全域在线智能顾问对话
     */
    @PostMapping("/advisor-dialog")
    public ApiResponse<AiInvokeResponse> chatAdvisor(@RequestBody Map<String, Object> params) {
        String sessionId = String.valueOf(params.getOrDefault("sessionId", "sess-" + System.currentTimeMillis()));
        log.info("[SERVICE-AI] 触发全域智能农业顾问咨询: sessionId={}", sessionId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("service.advisor.dialog")
                .bizSystem("service_hub")
                .bizId(sessionId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("智能顾问解答完成", response);
    }

    /**
     * 客商合作需求与意向成熟度智能清洗定级
     */
    @PostMapping("/lead-qualify")
    public ApiResponse<AiInvokeResponse> qualifyLead(@RequestBody Map<String, Object> params) {
        String leadId = String.valueOf(params.getOrDefault("leadId", "lead-" + System.currentTimeMillis()));
        log.info("[SERVICE-AI] 触发商机意向智能评级: leadId={}", leadId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("service.lead.qualify")
                .bizSystem("service_hub")
                .bizId(leadId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("商机意向智能定级与分流完成", response);
    }
}
