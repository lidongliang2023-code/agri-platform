package com.agri.satellite.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 供应商路由配置：场景 → 供应商。API Key 从环境变量注入，绝不写入代码库。
 */
@Data
@Component
@ConfigurationProperties(prefix = "agri.ai")
public class AiProviderProperties {

    /** 总开关：false 时全部降级为规则模式（可降级，8.3 治理底线） */
    private boolean enabled = false;

    /** 每场景每分钟请求上限 */
    private int rateLimitPerMinute = 60;

    /** 每千 token 成本（元），用于成本核算 */
    private BigDecimal costPer1kTokens = new BigDecimal("0.02");

    /** 场景 → 供应商配置（base-url 指向 OpenAI 兼容接口） */
    private Map<String, Provider> providers = new LinkedHashMap<>(Map.of(
            "general", new Provider("https://api.example-llm.com/v1", "", "gpt-4o-mini"),
            "vision", new Provider("http://localhost:9100/v1", "", "yolov8-pest")));

    @Data
    public static class Provider {
        private String baseUrl;
        private String apiKey;
        private String model;

        public Provider() {
        }

        public Provider(String baseUrl, String apiKey, String model) {
            this.baseUrl = baseUrl;
            this.apiKey = apiKey;
            this.model = model;
        }
    }
}
