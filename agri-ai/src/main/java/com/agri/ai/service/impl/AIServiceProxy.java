package com.agri.ai.service.impl;

import com.agri.ai.config.AIConfig;
import com.agri.ai.service.AIService;
import org.springframework.stereotype.Service;

@Service
public class AIServiceProxy implements AIService {

    private final TongyiAIService tongyiAIService;
    private final OpenAIService openAIService;
    private final AIConfig config;

    public AIServiceProxy(TongyiAIService tongyiAIService, OpenAIService openAIService, AIConfig config) {
        this.tongyiAIService = tongyiAIService;
        this.openAIService = openAIService;
        this.config = config;
    }

    private AIService getCurrentService() {
        if ("openai".equalsIgnoreCase(config.getProvider())) {
            return openAIService;
        }
        return tongyiAIService;
    }

    @Override
    public String chat(String prompt) {
        return getCurrentService().chat(prompt);
    }

    @Override
    public String recommend(String context) {
        return getCurrentService().recommend(context);
    }

    @Override
    public String riskAnalysis(String context) {
        return getCurrentService().riskAnalysis(context);
    }

    @Override
    public String summarize(String text) {
        return getCurrentService().summarize(text);
    }
}