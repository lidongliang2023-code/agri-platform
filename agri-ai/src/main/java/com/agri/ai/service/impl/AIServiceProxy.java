package com.agri.ai.service.impl;

import com.agri.ai.config.AIConfig;
import com.agri.ai.service.AIService;
import org.springframework.stereotype.Service;

@Service
public class AIServiceProxy implements AIService {

    private final TongyiAIService tongyiAIService;
    private final OpenAIService openAIService;
    private final AIConfig config;
    private final com.agri.ai.service.RealModelClient modelClient;

    public AIServiceProxy(TongyiAIService tongyiAIService, OpenAIService openAIService, AIConfig config, com.agri.ai.service.RealModelClient modelClient) {
        this.modelClient=modelClient;
        this.tongyiAIService = tongyiAIService;
        this.openAIService = openAIService;
        this.config = config;
    }

    private String custom(String instruction, String input) {
        if(!config.isRealInferenceEnabled()) return "真实推理开关已关闭";
        try {
            var output=modelClient.complete(instruction,input==null?"":input).output();
            if(output.get("answer") instanceof String answer) return answer;
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(output);
        } catch(Exception e) { return "AI服务暂时不可用，请检查模型配置、故障切换与连接验证结果"; }
    }
    private AIService getCurrentService() {
        if ("openai".equalsIgnoreCase(config.getProvider())) {
            return openAIService;
        }
        return tongyiAIService;
    }

    @Override
    public String chat(String prompt) {
        return custom("你是农业产业互联网助手，请用中文回答。",prompt);
    }

    @Override
    public String recommend(String context) {
        return custom("请基于农业生产数据给出推荐建议。",context);
    }

    @Override
    public String riskAnalysis(String context) {
        return custom("请分析农业供应链数据风险。",context);
    }

    @Override
    public String summarize(String text) {
        return custom("请总结以下文本。",text);
    }
}