package com.agri.satellite.ai;

import com.agri.core.infra.util.JsonUtil;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * 病虫害识别接口（P2 阶段落地）：图片经网关进入本地视觉模型（YOLOv8/Qwen-VL），敏感数据不出云边界。
 * 当前为降级桩：未启用时返回规则模式应答，接口契约保持稳定。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ai/vision")
@RequiredArgsConstructor
public class VisionController {

    private final AiProviderProperties properties;
    private final JdbcTemplate jdbc;

    @PostMapping("/pest")
    public ApiResponse<Map<String, Object>> identifyPest(@RequestParam("file") MultipartFile file) throws Exception {
        boolean enabled = properties.isEnabled()
                && properties.getProviders().containsKey("vision");
        logCall(file.getSize(), enabled ? "OK" : "DEGRADED");
        if (!enabled) {
            return ApiResponse.ok(Map.of(
                    "degraded", true,
                    "answer", "病虫害识别服务尚未启用：请先通过「农事记录」人工登记病状，或联系平台农技服务台。",
                    "disclaimer", AiGatewayService.DISCLAIMER));
        }
        // 本地视觉模型集成点：转发图片到 agri.ai.providers.vision.base-url（MVP 未启用时不会到达此处）
        return ApiResponse.ok(Map.of(
                "degraded", true,
                "answer", "视觉模型通道已配置但推理端未就绪，请检查 satellite-ai-gateway 提供商配置。",
                "disclaimer", AiGatewayService.DISCLAIMER));
    }

    private void logCall(long bytes, String status) {
        try {
            jdbc.update("INSERT INTO ai_call_log (scenario, model, tokens, cost, status, called_at) VALUES ('vision','yolov8-pest',0,0,?,NOW())",
                    status);
        } catch (Exception e) {
            log.error("AI 调用日志落库失败: {}", e.getMessage());
        }
    }
}
