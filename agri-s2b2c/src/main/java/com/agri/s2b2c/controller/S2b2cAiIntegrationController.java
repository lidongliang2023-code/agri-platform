package com.agri.s2b2c.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * S2B2C平台与商家端 - AI能力中台集成适配器
 * 负责调用 AI 中台进行门店补货预测及全域分销商品文案生成
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/s2b2c/ai")
public class S2b2cAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public S2b2cAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 商家进销存智能周转与补货预测
     */
    @PostMapping("/inventory-forecast")
    public ApiResponse<AiInvokeResponse> forecastInventory(@RequestBody Map<String, Object> params) {
        String merchantId = String.valueOf(params.getOrDefault("merchantId", "mch-0089"));
        log.info("[S2B2C-AI] 触发商家进销存补货预测: merchantId={}", merchantId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("s2b2c.inventory.forecast")
                .bizSystem("s2b2c")
                .bizId(merchantId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("智能补货预测计算完成", response);
    }

    /**
     * 分销商品全域种草与营销文案生成
     */
    @PostMapping("/goods-copywrite")
    public ApiResponse<AiInvokeResponse> generateGoodsCopywrite(@RequestBody Map<String, Object> params) {
        String goodsId = String.valueOf(params.getOrDefault("goodsId", "spu-" + System.currentTimeMillis()));
        log.info("[S2B2C-AI] 触发商品智能文案生成: goodsId={}", goodsId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("s2b2c.goods.copywrite")
                .bizSystem("s2b2c")
                .bizId(goodsId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("营销推广文案生成成功", response);
    }
}
