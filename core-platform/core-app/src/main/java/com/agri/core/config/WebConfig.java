package com.agri.core.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

/**
 * CORS：显式来源白名单，绝不使用通配符（安全规范）。生产环境经环境变量注入。
 *
 * <p>两类来源配置，语义与放行边界不同，不可混用：
 *
 * <ol>
 *   <li>{@code agri.cors.allowed-origins}：精确来源白名单（scheme + host + port 全部写死）。
 *       这是生产环境唯一应当使用的配置，必须经 {@code AGRI_CORS_ORIGINS} 注入。</li>
 *   <li>{@code agri.cors.allowed-origin-patterns}：带端口通配符的来源模式，仅用于解决
 *       本机开发期 vite 端口漂移。默认值为 {@code http://localhost:*} 与
 *       {@code http://127.0.0.1:*}——通配符只出现在<b>端口位</b>，
 *       主机名固定为本机回环地址，因此不构成"任意来源放行"。
 *       {@code application-prod.yml} 已将其覆盖为空，生产环境不生效。</li>
 * </ol>
 *
 * <p><b>为什么必须放宽端口（BT-31 根因）</b>：前端 axios 的 baseURL 是相对路径
 * {@code /api/v1/production}，请求先打到 vite dev server（默认 5173，端口被占时会自动
 * 漂移到 5174/5175...），再由 vite proxy 转发到后端。vite 的 {@code changeOrigin} 只改写
 * {@code Host}，<b>不会改写 {@code Origin}</b>，于是后端收到的 Origin 是浏览器的端口。
 * 对后端而言这就是一个跨域请求：端口不在白名单内即返回
 * {@code 403 Invalid CORS request}。故仅列 5173/3000 不够，必须放开回环地址的任意端口。
 *
 * <p><b>为什么必须补 PATCH</b>：Spring 的 CorsFilter 对预检请求
 * （{@code Access-Control-Request-Method}）逐一校验 {@code allowedMethods}，
 * 不在列表内直接 403。在补 PATCH 之前，任何新增的 PATCH 端点在浏览器里都会被
 * 预检拦掉，表现为"接口已经补了但前端还是不通"。
 */
@Configuration
public class WebConfig {

    /** 允许的全部 HTTP 方法。PATCH 为 ⑥ 新增的状态变更端点（关闭/催办/重启）预留。 */
    private static final String[] ALLOWED_METHODS =
            {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"};

    /** 精确来源白名单，生产环境必须经 AGRI_CORS_ORIGINS 注入。 */
    private final List<String> allowedOrigins;

    /**
     * 来源模式白名单：仅用于放开本机回环地址的任意端口（vite 端口漂移）。
     * 主机名不含通配符；application-prod.yml 中默认为空。
     */
    private final List<String> allowedOriginPatterns;

    /**
     * 构造注入 CORS 来源配置。
     *
     * @param allowedOrigins        精确来源白名单（逗号分隔）
     * @param allowedOriginPatterns 来源模式白名单（逗号分隔，可为空）
     */
    public WebConfig(
            @Value("${agri.cors.allowed-origins:}") List<String> allowedOrigins,
            @Value("${agri.cors.allowed-origin-patterns:}") List<String> allowedOriginPatterns) {
        this.allowedOrigins = sanitize(allowedOrigins);
        this.allowedOriginPatterns = sanitize(allowedOriginPatterns);
    }

    /**
     * 注册 /api/** 的 CORS 映射。
     *
     * @return CORS 配置器
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(allowedOrigins.toArray(new String[0]))
                        .allowedOriginPatterns(allowedOriginPatterns.toArray(new String[0]))
                        .allowedMethods(ALLOWED_METHODS)
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }

    /**
     * 清洗来源配置：去掉 null / 空白项并去重，避免空串进入 CorsConfiguration 后
     * 被当成合法来源参与匹配。
     *
     * @param raw 原始配置列表，可为 null
     * @return 清洗后的列表，永不为 null
     */
    private static List<String> sanitize(List<String> raw) {
        List<String> result = new ArrayList<>();
        if (raw == null) {
            return result;
        }
        for (String item : raw) {
            if (item == null) {
                continue;
            }
            String trimmed = item.trim();
            if (!trimmed.isEmpty() && !result.contains(trimmed)) {
                result.add(trimmed);
            }
        }
        return result;
    }
}
