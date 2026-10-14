package com.agri.common.rbac;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 运营端准入的自动装配：子系统只要依赖 agri-common 并配好
 * {@code platform.rbac.operator-paths} 就生效，不需要各自写拦截器。
 *
 * <p>生效条件：Web 应用 + {@code platform.rbac.enabled=true}（默认 true）。
 * 没配 operator-paths 时组件仍然装上、只是不拦任何路径 —— 这正是最容易造成
 * "以为铺开了、其实没拦"的情形，所以装配时打 WARN，各子系统的实测用例也专门查它。</p>
 */
@Slf4j
@AutoConfiguration
@ConditionalOnWebApplication
@ConditionalOnProperty(prefix = "platform.rbac", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(RbacProperties.class)
public class RbacAutoConfiguration {

    /** 允许子系统换成自己的实现（本地缓存、网关透传等）。 */
    @Bean
    @ConditionalOnMissingBean(PermissionResolver.class)
    public PermissionResolver permissionResolver(RbacProperties properties,
                                                 @Value("${services.platform.url:}") String platformServiceUrl) {
        return new PlatformPermissionResolver(new RestTemplate(), resolveUrl(properties, platformServiceUrl));
    }

    @Bean
    @ConditionalOnMissingBean(OperatorGuardInterceptor.class)
    public OperatorGuardInterceptor operatorGuardInterceptor(PermissionResolver permissionResolver,
                                                             RbacProperties properties) {
        return new OperatorGuardInterceptor(permissionResolver, properties);
    }

    @Bean
    public WebMvcConfigurer operatorGuardRegistrar(OperatorGuardInterceptor interceptor,
                                                   RbacProperties properties) {
        log.info("运营端准入已装配：operatorPaths={} readPermission={} writePermission={}",
                properties.getOperatorPaths(), properties.getReadPermission(), properties.getWritePermission());
        if (properties.getOperatorPaths().isEmpty()) {
            log.warn("platform.rbac.operator-paths 为空 —— 本服务的运营端接口目前没有任何准入拦截，"
                    + "请按自己的运营路径配置，或用 @OperatorOnly 标注");
        }
        return new WebMvcConfigurer() {
            @Override
            public void addInterceptors(InterceptorRegistry registry) {
                registry.addInterceptor(interceptor)
                        .addPathPatterns("/**")
                        .excludePathPatterns("/actuator/**", "/error", "/v3/api-docs/**",
                                "/swagger-ui/**", "/doc.html", "/favicon.ico");
            }
        };
    }

    private String resolveUrl(RbacProperties properties, String platformServiceUrl) {
        String configured = properties.getPlatformUrl();
        return configured == null || configured.isBlank() ? platformServiceUrl : configured;
    }
}
