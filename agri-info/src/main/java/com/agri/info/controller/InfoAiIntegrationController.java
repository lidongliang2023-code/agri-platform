package com.agri.info.controller;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.common.ai.dto.AiInvokeResponse;
import com.agri.common.result.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 信息资讯与行情指数子系统 - AI能力中台集成适配器
 * 负责调用 AI 中台进行农业政策快报智能摘要提取与多源热点聚类
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/info/ai")
public class InfoAiIntegrationController {

    private final AgriAiClient agriAiClient;

    public InfoAiIntegrationController(AgriAiClient agriAiClient) {
        this.agriAiClient = agriAiClient;
    }

    /**
     * 产业政策与行情内参 100 字核心摘要萃取
     */
    @PostMapping("/digest-extract")
    public ApiResponse<AiInvokeResponse> extractDigest(@RequestBody Map<String, Object> params) {
        String articleId = String.valueOf(params.getOrDefault("articleId", "art-" + System.currentTimeMillis()));
        log.info("[INFO-AI] 触发产业快讯核心摘要智能萃取: articleId={}", articleId);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("info.digest.extract")
                .bizSystem("info_news")
                .bizId(articleId)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("产业资讯摘要萃取成功", response);
    }

    /**
     * 多源农情资讯热点聚类与排重
     */
    @PostMapping("/topic-cluster")
    public ApiResponse<AiInvokeResponse> clusterTopics(@RequestBody Map<String, Object> params) {
        String clusterKey = String.valueOf(params.getOrDefault("clusterKey", "cluster-citrus-week"));
        log.info("[INFO-AI] 触发多源资讯热点聚合: clusterKey={}", clusterKey);

        AiInvokeRequest req = AiInvokeRequest.builder()
                .sceneCode("info.topic.cluster")
                .bizSystem("info_news")
                .bizId(clusterKey)
                .input(params)
                .build();

        AiInvokeResponse response = agriAiClient.invoke(req);
        return ApiResponse.success("多源热点聚合聚类完成", response);
    }
}
