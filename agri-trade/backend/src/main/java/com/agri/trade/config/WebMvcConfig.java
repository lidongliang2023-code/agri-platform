package com.agri.trade.config;

import com.agri.trade.common.capability.TradeCapabilityInterceptor;
import com.agri.trade.common.security.AuthenticationInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 注册认证拦截器。
 *
 * <p>默认对全部路径生效，只放行接口文档与错误页 —— 白名单是"明确写出来"的，
 * 而不是让业务接口默认裸奔、由各控制器自己记得加校验。</p>
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthenticationInterceptor authenticationInterceptor;
    private final TradeCapabilityInterceptor tradeCapabilityInterceptor;
    private final String uploadDir;

    public WebMvcConfig(AuthenticationInterceptor authenticationInterceptor,
                        TradeCapabilityInterceptor tradeCapabilityInterceptor,
                        @Value("${agri.trade.upload-dir:uploads}") String uploadDir) {
        this.authenticationInterceptor = authenticationInterceptor;
        this.tradeCapabilityInterceptor = tradeCapabilityInterceptor;
        this.uploadDir = uploadDir;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authenticationInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/swagger-ui/**",
                        "/v3/api-docs/**",
                        "/swagger-resources/**",
                        "/webjars/**",
                        "/doc.html",
                        "/favicon.ico",
                        "/error",
                        // 运营端上传的商品图片是公开展示资源；文件名为服务端 UUID，不含经营数据。
                        "/uploads/trade/**",
                        // 官网门户公开只读接口：仅返回已发布商品的展示字段
                        "/api/trade/public/**"
                );
        // 能力校验只覆盖用户侧写接口：运营端 /api/trade/admin/**、公开只读、图片上传不参与
        registry.addInterceptor(tradeCapabilityInterceptor)
                .addPathPatterns("/api/trade/**")
                .excludePathPatterns(
                        "/api/trade/admin/**",
                        "/api/trade/public/**",
                        "/uploads/trade/**"
                );
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = Paths.get(uploadDir, "trade").toAbsolutePath().normalize();
        String location = root.toUri().toString();
        if (!location.endsWith("/")) {
            location += "/";
        }
        registry.addResourceHandler("/uploads/trade/**")
                .addResourceLocations(location);
    }
}
