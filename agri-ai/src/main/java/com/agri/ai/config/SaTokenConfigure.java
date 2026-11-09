package com.agri.ai.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.router.SaRouter;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * AI 中台统一登录鉴权拦截配置
 * 融入产业互联网平台统一登录 (SSO) 与 Sa-Token 鉴权体系
 */
@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册 Sa-Token 拦截器
        registry.addInterceptor(new SaInterceptor(handler -> {
            // 管理控制台与场景配置等运营级接口必须具备平台登录态
            SaRouter.match("/api/ai/admin/**", r -> StpUtil.checkLogin());
            // 细粒度权限校验
            SaRouter.match("/api/ai/admin/scene/**", r -> StpUtil.checkPermission("ai:scene:manage"));
            SaRouter.match("/api/ai/admin/prompt/**", r -> StpUtil.checkPermission("ai:prompt:manage"));
        })).addPathPatterns("/**");
    }
}
