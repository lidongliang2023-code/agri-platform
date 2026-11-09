package com.agri.trade.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 交易撮合与交易大厅 - AI能力中台集成适配器
 * 负责调用 AI 中台进行批发价格波动归因和买卖订单极速智能撮合
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/trade/ai")
public class TradeAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public TradeAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 行情异动归因诊断报告生成
     */
    @PostMapping("/price-diagnosis")
    public ApiResponse<AiInvokeResponse> diagnosePriceFluctuation(@RequestBody Map<String, Object> params) {
        String variety = String.valueOf(params.getOrDefault("variety", "优质沃柑"));
        log.info("[TRADE-AI] 触发大宗行情异动归因分析: variety={}", variety);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("trade.price.diagnosis")
                .bizSystem("trade_match")
                .bizId("variety-" + variety)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("行情异动归因报告生成成功", response);
    }

    /**
     * 现货委托订单智能撮合推荐
     */
    @PostMapping("/order-match")
    public ApiResponse<AiInvokeResponse> matchTradeOrder(@RequestBody Map<String, Object> params) {
        String orderId = String.valueOf(params.getOrDefault("orderId", "ord-" + System.currentTimeMillis()));
        log.info("[TRADE-AI] 触发买卖盘智能撮合: orderId={}", orderId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("trade.order.match")
                .bizSystem("trade_match")
                .bizId(orderId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("供需智能撮合匹配计算完成", response);
    }
}
