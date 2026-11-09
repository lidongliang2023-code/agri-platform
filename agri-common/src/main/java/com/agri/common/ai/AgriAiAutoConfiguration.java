package com.agri.common.ai;

import com.agri.common.ai.client.AgriAiClient;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/** 为依赖公共模块的业务服务提供统一 AI 调度客户端。 */
@AutoConfiguration
public class AgriAiAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(AgriAiClient.class)
    public AgriAiClient agriAiClient() {
        return new AgriAiClient();
    }
}
