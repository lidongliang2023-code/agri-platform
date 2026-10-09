package com.agri.satellite.ai;

import com.agri.core.infra.util.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 模型调用核心逻辑：供应商路由 → 限流 → 调用（OpenAI 兼容协议）→ 成本核算 → 失败降级。
 * 治理底线（8.3）：输出可溯源、可降级、可核算；知识库答案须附免责声明。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiGatewayService {

    public static final String DISCLAIMER = "AI 输出仅供参考，请结合农技专家意见与现场实际情况判断。";

    private final AiProviderProperties properties;
    private final RateLimiter rateLimiter;
    private final JdbcTemplate jdbc;
    private final RestClient restClient = RestClient.create();

    public record ChatMessage(String role, String content) {
    }

    public record ChatResult(String answer, String model, boolean degraded, String disclaimer) {
    }

    public ChatResult chat(String scenario, List<ChatMessage> messages) {
        String scene = (scenario == null || scenario.isBlank()) ? "general" : scenario;
        if (!rateLimiter.allow(scene, properties.getRateLimitPerMinute())) {
            throw new com.agri.shared.exception.BusinessException(429, "请求过于频繁，请稍后重试");
        }
        AiProviderProperties.Provider provider = properties.getProviders().get(scene);
        if (!properties.isEnabled() || provider == null
                || provider.getApiKey() == null || provider.getApiKey().isBlank()) {
            log.info("AI 场景 {} 未启用或缺少密钥，降级为规则模式", scene);
            logCall(scene, provider == null ? "-" : provider.getModel(), 0, BigDecimal.ZERO, "DEGRADED");
            return new ChatResult("当前处于规则模式：请参照农事操作手册处理，或联系平台农技服务台。",
                    "-", true, DISCLAIMER);
        }
        try {
            Map<?, ?> response = restClient.post()
                    .uri(provider.getBaseUrl() + "/chat/completions")
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", provider.getModel(), "messages", messages))
                    .retrieve()
                    .body(Map.class);

            String answer = extractAnswer(response);
            long tokens = extractTokens(response);
            BigDecimal cost = properties.getCostPer1kTokens()
                    .multiply(BigDecimal.valueOf(tokens))
                    .divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP);
            logCall(scene, provider.getModel(), tokens, cost, "OK");
            return new ChatResult(answer, provider.getModel(), false, DISCLAIMER);
        } catch (Exception e) {
            // 熔断降级：网关故障不阻塞业务主流程
            log.error("AI 调用失败，降级: scene={}, {}", scene, e.getMessage());
            logCall(scene, provider.getModel(), 0, BigDecimal.ZERO, "FAILED");
            return new ChatResult("AI 服务暂时不可用（已自动降级），请稍后重试或联系人工服务。",
                    provider.getModel(), true, DISCLAIMER);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractAnswer(Map<?, ?> response) {
        if (response == null) {
            return "";
        }
        List<?> choices = (List<?>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            return "";
        }
        Map<?, ?> first = (Map<?, ?>) choices.get(0);
        Map<?, ?> message = (Map<?, ?>) first.get("message");
        Object content = message == null ? null : message.get("content");
        return content == null ? "" : String.valueOf(content);
    }

    private long extractTokens(Map<?, ?> response) {
        if (response == null || !(response.get("usage") instanceof Map<?, ?> usage)) {
            return 0;
        }
        Object total = usage.get("total_tokens");
        return total instanceof Number n ? n.longValue() : 0;
    }

    private void logCall(String scenario, String model, long tokens, BigDecimal cost, String status) {
        try {
            jdbc.update("INSERT INTO ai_call_log (scenario, model, tokens, cost, status, called_at) VALUES (?,?,?,?,?,NOW())",
                    scenario, model, tokens, cost, status);
        } catch (Exception e) {
            log.error("AI 调用日志落库失败: {}", e.getMessage());
        }
    }
}
