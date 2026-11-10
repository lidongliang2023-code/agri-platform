package com.agri.ai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;
import java.util.*;

/** 管理接口使用统一认证中心的令牌与权限，不依赖独立 JVM 的本地 Sa-Token 会话。 */
@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {
    private final RestTemplate http;
    private final String platformUrl;
    private final ObjectMapper json;
    public SaTokenConfigure(@Value("${services.platform.url:http://localhost:8093}") String platformUrl, ObjectMapper json) {
        this.platformUrl = platformUrl.replaceAll("/+$", "");
        this.json = json;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000); factory.setReadTimeout(5000);
        this.http = new RestTemplate(factory);
    }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
                String token = req.getHeader("Authorization");
                if (token == null || !token.startsWith("Bearer ") || token.substring(7).isBlank())
                    return deny(res, 401, "请先通过平台统一登录");
                try {
                    HttpHeaders headers = new HttpHeaders(); headers.set("Authorization", token);
                    Map<?,?> body = http.exchange(platformUrl + "/api/v1/platform/permissions/mine", HttpMethod.GET,
                            new HttpEntity<>(headers), Map.class).getBody();
                    if (body == null || !Objects.equals(body.get("code"), 0) || !(body.get("data") instanceof Map<?,?> data))
                        return deny(res, 401, "平台登录已失效");
                    Object raw = data.get("permissions");
                    if (!(raw instanceof Collection<?> permissions) || !(permissions.contains("*") || permissions.contains("ai:*") || permissions.contains("ai:admin")))
                        return deny(res, 403, "当前账号没有 AI 中台管理权限（ai:admin）");
                    // 记录已核验的固定账号标识，绝不使用客户端自报的昵称或主体头。
                    Object userId=data.get("userId");
                    if(userId==null) return deny(res,401,"认证响应缺少固定账号标识");
                    req.setAttribute("ai.operator", String.valueOf(userId));
                    return true;
                } catch (org.springframework.web.client.HttpClientErrorException e) {
                    return deny(res, e.getStatusCode().value() == 403 ? 403 : 401, "统一登录凭证无效或已失效");
                } catch (Exception e) {
                    return deny(res, 503, "统一认证中心暂时不可达，请稍后重试");
                }
            }
        }).addPathPatterns("/api/ai/admin/**", "/ai/admin/**");
    }
    private boolean deny(HttpServletResponse res, int code, String message) throws Exception {
        res.setStatus(code); res.setContentType("application/json;charset=UTF-8");
        json.writeValue(res.getWriter(), Map.of("code", code, "message", message));
        return false;
    }
}
