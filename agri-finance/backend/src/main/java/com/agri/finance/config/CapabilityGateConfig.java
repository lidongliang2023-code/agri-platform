package com.agri.finance.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 只给「融资申请」挂能力校验：查询、还款等接口保持原有鉴权，避免一次性改动面过大。
 */
@Configuration
@RequiredArgsConstructor
public class CapabilityGateConfig implements WebMvcConfigurer {

    private final FinanceCapabilityInterceptor financeCapabilityInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(financeCapabilityInterceptor)
                .addPathPatterns("/api/v1/loan/apply");
    }
}
