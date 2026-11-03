package com.agri.government.common.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class GovernmentCapabilityConfig implements WebMvcConfigurer {

    private final GovernmentCapabilityInterceptor governmentCapabilityInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(governmentCapabilityInterceptor)
                .addPathPatterns("/api/v1/government/mobile/**");
    }
}
