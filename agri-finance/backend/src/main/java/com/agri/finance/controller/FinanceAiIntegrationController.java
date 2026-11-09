package com.agri.finance.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 供应链金融子系统 - AI能力中台集成适配器
 * 负责调用 AI 中台进行种植主体授信画像评估与仓单质押物动态风控
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/finance/ai")
public class FinanceAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public FinanceAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 农业主体履约信用与授信额度智能评估
     */
    @PostMapping("/credit-assessment")
    public ApiResponse<AiInvokeResponse> assessCredit(@RequestBody Map<String, Object> params) {
        String enterpriseId = String.valueOf(params.getOrDefault("enterpriseId", "ent-coop-8801"));
        log.info("[FINANCE-AI] 触发农业经营主体信用评估: enterpriseId={}", enterpriseId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("fin.credit.assessment")
                .bizSystem("supply_fin")
                .bizId(enterpriseId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("主体数字化授信评估完成", response);
    }

    /**
     * 仓单与质押物贬值动态风险监控
     */
    @PostMapping("/pledge-risk")
    public ApiResponse<AiInvokeResponse> monitorPledgeRisk(@RequestBody Map<String, Object> params) {
        String receiptId = String.valueOf(params.getOrDefault("receiptId", "rcpt-wh-9021"));
        log.info("[FINANCE-AI] 触发仓单质押物实时风险监控: receiptId={}", receiptId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("fin.pledge.risk")
                .bizSystem("supply_fin")
                .bizId(receiptId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("质押物贬值风控分析完成", response);
    }
}
