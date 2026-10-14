package com.agri.common.rbac;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 调平台认证中心解析权限码（RBAC 的实时鉴权那一半）。
 *
 * <p>用 RestTemplate 而不是 Feign：这是一个要下沉给**所有子系统**的基础能力，
 * 而 Feign 客户端得靠各应用扫描到对应包才会注册 —— 少配一处就是"组件装上了、
 * 接口全 403"，排查成本远高于省下的那几行代码。</p>
 *
 * <p><b>拿不到权限一律返回 null（调用方 fail closed）</b>：认证中心不可达、令牌过期、
 * 返回体不认识，都不放行 —— 与"解析不到经营主体时宁可报错也不看全部"同一口径。</p>
 */
@Slf4j
public class PlatformPermissionResolver implements PermissionResolver {

    private static final String WILDCARD = "*";
    private static final String REQUEST_ATTR = PlatformPermissionResolver.class.getName() + ".permissions";

    private final RestTemplate restTemplate;
    private final String platformUrl;

    public PlatformPermissionResolver(RestTemplate restTemplate, String platformUrl) {
        this.restTemplate = restTemplate;
        this.platformUrl = platformUrl;
    }

    @Override
    public Set<String> currentPermissions() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return null;
        }
        Object cached = request.getAttribute(REQUEST_ATTR);
        if (cached instanceof Set<?> set) {
            @SuppressWarnings("unchecked")
            Set<String> typed = (Set<String>) set;
            return typed;
        }

        String token = bearerToken(request);
        if (token == null) {
            // 没有令牌不该在这里判成"无权限" —— 认证是各子系统自己那一层的事，
            // 这里只做授权。返回 null 由拦截器区分对待（见 OperatorGuardInterceptor）。
            return null;
        }
        if (platformUrl == null || platformUrl.isBlank()) {
            log.warn("未配置平台地址（platform.rbac.platform-url 或 services.platform.url），无法解析权限");
            return null;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            ResponseEntity<Map> response = restTemplate.exchange(
                    platformUrl + "/api/v1/platform/permissions/mine",
                    HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Set<String> permissions = readPermissions(response.getBody());
            if (permissions == null) {
                return null;
            }
            request.setAttribute(REQUEST_ATTR, permissions);
            return permissions;
        } catch (Exception e) {
            log.warn("解析平台权限失败：{}", e.getMessage());
            return null;
        }
    }

    /** 认证中心返回 {@code {code:0,data:{permissions:[...]}}}；结构不认识就当解析失败。 */
    @SuppressWarnings("unchecked")
    private Set<String> readPermissions(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object data = body.get("data");
        if (!(data instanceof Map<?, ?> dataMap)) {
            return null;
        }
        Object perms = ((Map<String, Object>) dataMap).get("permissions");
        if (!(perms instanceof List<?> list)) {
            return Collections.emptySet();
        }
        Set<String> result = new LinkedHashSet<>();
        for (Object item : list) {
            if (item != null) {
                result.add(String.valueOf(item).trim());
            }
        }
        return result;
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
    }

    /** 是否具备某个权限码（支持 {@code *} 与 {@code prefix:*}）。 */
    public static boolean granted(Set<String> permissions, String code) {
        if (permissions == null || code == null || code.isBlank()) {
            return false;
        }
        if (permissions.contains(WILDCARD) || permissions.contains(code)) {
            return true;
        }
        int colon = code.indexOf(':');
        return colon > 0 && permissions.contains(code.substring(0, colon) + ":*");
    }
}
