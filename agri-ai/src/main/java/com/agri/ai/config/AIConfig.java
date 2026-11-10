package com.agri.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ai")
public class AIConfig {
    private TongyiConfig tongyi = new TongyiConfig();
    private OpenAIConfig openai = new OpenAIConfig();
    private String provider = "tongyi";
    private boolean realInferenceEnabled = true;
    private boolean fallbackToRuleTemplate = true;
    private int connectTimeoutMs = 5000;
    private int requestTimeoutMs = 45000;

    public TongyiConfig getTongyi() { return tongyi; }
    public void setTongyi(TongyiConfig value) { this.tongyi = value; }
    public OpenAIConfig getOpenai() { return openai; }
    public void setOpenai(OpenAIConfig value) { this.openai = value; }
    public String getProvider() { return provider; }
    public void setProvider(String value) { this.provider = value; }
    public boolean isRealInferenceEnabled() { return realInferenceEnabled; }
    public void setRealInferenceEnabled(boolean value) { this.realInferenceEnabled = value; }
    public boolean isFallbackToRuleTemplate() { return fallbackToRuleTemplate; }
    public void setFallbackToRuleTemplate(boolean value) { this.fallbackToRuleTemplate = value; }
    public int getConnectTimeoutMs() { return connectTimeoutMs; }
    public void setConnectTimeoutMs(int value) { this.connectTimeoutMs = value; }
    public int getRequestTimeoutMs() { return requestTimeoutMs; }
    public void setRequestTimeoutMs(int value) { this.requestTimeoutMs = value; }

    public static class TongyiConfig {
        private String apiKey;
        private String baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
        private String model = "qwen-turbo";
        public String getApiKey() { return apiKey; }
        public void setApiKey(String value) { this.apiKey = value; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String value) { this.baseUrl = value; }
        public String getModel() { return model; }
        public void setModel(String value) { this.model = value; }
    }

    public static class OpenAIConfig {
        private String apiKey;
        private String baseUrl = "https://api.openai.com/v1";
        private String model = "gpt-4o-mini";
        public String getApiKey() { return apiKey; }
        public void setApiKey(String value) { this.apiKey = value; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String value) { this.baseUrl = value; }
        public String getModel() { return model; }
        public void setModel(String value) { this.model = value; }
    }
}
