package com.agri.service.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 只给服务商移动工作台挂能力校验；其余服务域接口保持原有 RBAC。
 */
@Configuration
@RequiredArgsConstructor
public class ServiceCapabilityConfig implements WebMvcConfigurer {

    private final ServiceCapabilityInterceptor serviceCapabilityInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(serviceCapabilityInterceptor)
                .addPathPatterns("/api/v1/service/mobile/workbench/**");
    }
}
