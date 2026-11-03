package com.agri.common.config;

import com.agri.common.security.AuthenticationInterceptor;
import com.agri.common.security.PermissionPointGuard;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    /**
     * 两条链路必须同进同出：权限点判定要读登录态（{@code LoginUserHolder}），
     * 所以它排在认证拦截器之后，排除项也必须完全一致 —— 少排除一个就会在没登录态时静默放行。
     */
    private static final String[] PUBLIC_PATHS = {
            "/api/auth/login",
            "/api/auth/logout",
            "/api/auth/register",
            "/api/auth/check",
            "/api/auth/encode-password",
            "/api/auth/captcha",
            // 官网门户公开只读通道（PortalPublicController）：只开放已发布公告的展示字段。
            // 认证与权限点两条拦截链的排除项必须一致，少排除一个就会在没登录态时静默放行。
            "/api/master-data/public/**",
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/swagger-resources/**",
            "/webjars/**",
            "/doc.html",
            "/favicon.ico",
            "/error"
    };

    private final AuthenticationInterceptor authenticationInterceptor;
    private final PermissionPointGuard permissionPointGuard;

    public WebMvcConfig(AuthenticationInterceptor authenticationInterceptor, PermissionPointGuard permissionPointGuard) {
        this.authenticationInterceptor = authenticationInterceptor;
        this.permissionPointGuard = permissionPointGuard;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authenticationInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(PUBLIC_PATHS);
        // 顺序即语义：先确认"是谁"，再判断"这个动作他有没有被授权"
        registry.addInterceptor(permissionPointGuard)
                .addPathPatterns("/**")
                .excludePathPatterns(PUBLIC_PATHS);
    }
}
