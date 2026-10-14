package com.agri.common.rbac;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * 运营端准入拦截器（所有子系统共用这一份）。
 *
 * <p>判定两件事，合起来才没有漏网：
 * <ol>
 *   <li>路径命中 {@code platform.rbac.operator-paths} → 要 {@code read-permission}；</li>
 *   <li>方法/类上有 {@link OperatorOnly} → 要它声明的权限码（留空则用 {@code write-permission}）。</li>
 * </ol></p>
 *
 * <p><b>没有令牌时放行</b>：认证是各子系统自己那一层的事（有的在网关做、有的在过滤器做），
 * 这里只做授权。否则会出现"没登录被告知无权限"这种把人引向错误方向的提示。</p>
 *
 * <p><b>解析不到权限时拒绝（fail closed）</b>：认证中心不可达、令牌过期、
 * 返回体不认识 —— 都不放行，并明确说是权限解析的问题，而不是笼统的 403。</p>
 */
@Slf4j
@RequiredArgsConstructor
public class OperatorGuardInterceptor implements HandlerInterceptor {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final String AUTHORIZATION = "Authorization";

    private final PermissionResolver permissionResolver;
    private final RbacProperties properties;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        String required = requiredPermission(request, handlerMethod);
        if (required == null) {
            return true;
        }
        // 没带令牌：交给各子系统自己的认证层处理（那是 401 的语义，不是 403）
        String header = request.getHeader(AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return true;
        }

        Set<String> permissions = permissionResolver.currentPermissions();
        if (permissions == null) {
            return reject(response, "无法解析你的平台权限（认证中心不可达或令牌已失效），为安全起见已拒绝该操作，请稍后重试");
        }
        if (PlatformPermissionResolver.granted(permissions, required)) {
            return true;
        }
        log.warn("运营权限不足被拒：uri={} required={} granted={}", request.getRequestURI(), required, permissions);
        return reject(response, "你的账号没有该操作的权限（需要 " + required + "），请联系平台运营开通");
    }

    /** 这个请求需要哪个权限码；普通业务接口返回 null。 */
    private String requiredPermission(HttpServletRequest request, HandlerMethod handlerMethod) {
        OperatorOnly annotation = handlerMethod.getMethodAnnotation(OperatorOnly.class);
        if (annotation == null) {
            annotation = handlerMethod.getBeanType().getAnnotation(OperatorOnly.class);
        }
        if (annotation != null) {
            return annotation.value().isBlank() ? properties.getWritePermission() : annotation.value();
        }
        String uri = request.getRequestURI();
        for (String pattern : properties.getOperatorPaths()) {
            if (pattern != null && !pattern.isBlank() && MATCHER.match(pattern, uri)) {
                // 读接口要读权限，写接口要写权限 —— 只按"运营路径一律要读权限"会放过写：
                // 运营端页面里"查询"与"新增/修改/删除"常常共用一个路径前缀。
                return isReadMethod(request.getMethod())
                        ? properties.getReadPermission()
                        : properties.getWritePermission();
            }
        }
        return null;
    }

    private boolean isReadMethod(String method) {
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method);
    }

    private boolean reject(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        // 不依赖各子系统的响应体结构：code/message/data 是它们共同的最小交集
        response.getWriter().write("{\"code\":403,\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
