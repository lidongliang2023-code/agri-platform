package com.agri.info.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** 私域归属只认认证中心验证的账号 ID，禁止以昵称或客户端请求头充当身份。 */
@Component
public class InfoIdentity {
    private static final String ATTRIBUTE = InfoIdentity.class.getName() + ".owner";
    private final RestTemplate auth;
    private final String platform;

    public InfoIdentity(@Value("${services.platform.url:http://localhost:8093}") String platform) {
        this.platform = platform;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.auth = new RestTemplate(factory);
    }

    public String owner() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
        }
        var request = attributes.getRequest();
        if (request.getAttribute(ATTRIBUTE) instanceof String cached) {
            return cached;
        }
        String token = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (token == null || !token.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
        }
        try {
            var headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, token);
            Map<?, ?> response = auth.exchange(platform + "/api/v1/auth/me", HttpMethod.GET,
                    new HttpEntity<>(headers), Map.class).getBody();
            if (response != null && response.get("data") instanceof Map<?, ?> data
                    && data.get("id") != null) {
                String id = data.get("id").toString();
                if (id.matches("[0-9]+")) {
                    String owner = "uid:" + id;
                    request.setAttribute(ATTRIBUTE, owner);
                    return owner;
                }
            }
        } catch (org.springframework.web.client.RestClientException ignored) {
            // 认证服务失败时关闭访问，不回退至客户端昵称。
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录状态无效，请重新登录");
    }
}
