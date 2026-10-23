package com.agri.ai.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "ai")
public class AIConfig {

    private TongyiConfig tongyi = new TongyiConfig();
    private OpenAIConfig openai = new OpenAIConfig();
    private String provider = "tongyi";

    @Data
    public static class TongyiConfig {
        private String apiKey;
        private String baseUrl = "https://dashscope.aliyuncs.com/api/v1";
    }

    @Data
    public static class OpenAIConfig {
        private String apiKey;
        private String baseUrl = "https://api.openai.com/v1";
    }
}