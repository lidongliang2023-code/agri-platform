package com.agri.trade.service;

import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.feign.PlatformFeignClient;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 运营权限判定（RBAC 的"实时鉴权"那一半）。
 *
 * <p>权限来源是平台的 {@code platform_user_role} ⋈ {@code platform_role.permissions}，
 * 经 {@code /api/v1/platform/permissions/mine} 按调用方令牌 + 当前市场实时解析 ——
 * 架构文档 V2.0 第 5.5 节：令牌里的 roles 只是摘要，"细权限以后端实时鉴权为准"。
 * 这样运营改了角色权限，子系统立刻生效，不需要等令牌过期。</p>
 *
 * <p><b>拿不到权限一律拒绝（fail closed）</b>：平台不可达时既不放行、也不退化成
 * "只看令牌里的角色摘要" —— 与 PlatformIdentityService 解析不到主体时宁可报错
 * 也不"看全部"是同一口径。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OperatorPermissionService {

    /** 通配权限码。 */
    private static final String WILDCARD = "*";

    private static final String REQUEST_ATTR = OperatorPermissionService.class.getName() + ".perms";

    /**
     * 认证中心客户端用 {@link ObjectProvider} 懒取，不是图新鲜：
     * 拦截器 ← 本服务 ← PlatformFeignClient ← WebMvc 配置 ← 拦截器 会构成
     * Spring Boot 2.6+ 默认禁止的循环依赖（实测启动直接失败）。
     * 懒取把这条边推迟到真正发请求的那一刻，循环自然断开。
     */
    private final ObjectProvider<PlatformFeignClient> platformFeignClientProvider;

    /** 判定结果：allowed=false 时 message 是给用户看的原因。 */
    public record Decision(boolean allowed, String message) {

        static Decision allow() {
            return new Decision(true, null);
        }

        static Decision deny(String message) {
            return new Decision(false, message);
        }
    }

    /**
     * 当前调用方是否具备某个权限码。
     *
     * @param permission 权限码，如 {@code trade:read} / {@code trade:write}
     */
    public Decision check(String permission) {
        Set<String> granted = currentPermissions();
        if (granted == null) {
            return Decision.deny("无法解析你的平台权限（认证中心不可达），为安全起见已拒绝该操作，请稍后重试");
        }
        if (granted.contains(WILDCARD)) {
            return Decision.allow();
        }
        if (granted.contains(permission)) {
            return Decision.allow();
        }
        // 支持 "trade:*" 这种前缀通配
        int colon = permission.indexOf(':');
        if (colon > 0 && granted.contains(permission.substring(0, colon) + ":*")) {
            return Decision.allow();
        }
        return Decision.deny("你的账号没有该操作的权限（需要 " + permission + "），请联系平台运营开通");
    }

    /**
     * 当前请求的权限码集合；解析失败返回 null（调用方据此 fail closed）。
     *
     * <p>请求级缓存：挂在 HttpServletRequest 上，一次请求只回源认证中心一次。</p>
     */
    private Set<String> currentPermissions() {
        HttpServletRequest request = SecurityUtils.getRequest();
        if (request == null) {
            return null;
        }
        Object cached = request.getAttribute(REQUEST_ATTR);
        if (cached instanceof Set<?> set) {
            @SuppressWarnings("unchecked")
            Set<String> typed = (Set<String>) set;
            return typed;
        }

        String token = SecurityUtils.getToken();
        if (token == null || token.isEmpty()) {
            return null;
        }
        try {
            Map<String, Object> res = platformFeignClientProvider.getObject().myPermissions("Bearer " + token);
            Set<String> permissions = readPermissions(res);
            request.setAttribute(REQUEST_ATTR, permissions);
            return permissions;
        } catch (Exception e) {
            log.warn("解析平台权限失败：{}", e.getMessage());
            return null;
        }
    }

    private Set<String> readPermissions(Map<String, Object> res) {
        if (res == null) {
            return null;
        }
        Object data = res.get("data");
        if (!(data instanceof Map<?, ?>)) {
            return null;
        }
        Map<?, ?> dataMap = (Map<?, ?>) data;
        Object perms = dataMap.get("permissions");
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
}
