package com.agri.produce.internal.capability;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 注册生产域能力拦截器：只覆盖 {@code /api/v1/production/**} 的写方法。
 */
@Configuration
@RequiredArgsConstructor
public class ProductionCapabilityConfig implements WebMvcConfigurer {

    private final ProductionCapabilityInterceptor productionCapabilityInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(productionCapabilityInterceptor)
                .addPathPatterns("/api/v1/production/**")
                .excludePathPatterns("/api/v1/production/admin/**");
    }
}
