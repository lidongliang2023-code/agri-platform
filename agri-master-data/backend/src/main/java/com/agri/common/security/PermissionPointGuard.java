package com.agri.common.security;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.service.IPermissionService;
import com.agri.masterdata.service.PermissionPointCatalogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/**
 * 权限点鉴权（按钮级 / API 级）。
 *
 * <p>规则只有一条：<b>一个权限点一旦被任何角色持有，它就变成受管端点</b>；
 * 没被任何角色持有的点不拦（"未纳管"）。这样做的理由：</p>
 * <ul>
 *   <li>目录是从端点映射全量同步的，几百个点一上线就全部生效会把整个后台锁死 —— 那是造事故，不是加安全；</li>
 *   <li>授权动作本身就是"我要开始管这个端点"的信号：勾上即收紧、取消所有角色的勾选即放开，
 *       语义只有一条，不需要再引入"启用/停用"开关列；</li>
 *   <li>只有写方法参与（与目录只登记写方法一致）—— 读接口一旦被收紧，
 *       勾一个点就把别人的列表页整片锁死，那不是授权。</li>
 * </ul>
 *
 * <p>平台超管（{@code permissions} 含 {@code *}，或角色含 {@code SUPER_ADMIN}）始终放行，
 * 避免把自己关在门外。</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PermissionPointGuard implements HandlerInterceptor {

    /** 只有写方法参与判定，与目录只登记写方法保持一致 */
    private static final Set<String> ACTION_VERBS = Set.of("POST", "PUT", "DELETE", "PATCH");

    private final IPermissionService permissionService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof org.springframework.web.method.HandlerMethod)) {
            return true;
        }
        LoginUser loginUser = LoginUserHolder.getLoginUser();
        if (loginUser == null) {
            // 认证拦截器在前，走到这里还没有登录态属于异常情况；不在这里替它决定
            return true;
        }
        String pattern = bestMatchingPattern(request);
        // 作用域判定与目录同步共用一处：登记范围与拦截范围不一致 = 有的端点看着受管其实没人管
        if (!PermissionPointCatalogService.isScoped(pattern)) {
            return true;
        }
        String verb = request.getMethod() == null ? "" : request.getMethod().trim().toUpperCase();
        if (!ACTION_VERBS.contains(verb)) {
            return true;
        }
        String code = PermissionPointCatalogService.codeOf(verb, pattern);
        if (!deniedFor(loginUser).contains(code)) {
            return true;
        }
        log.warn("权限点拦截：{} 缺少 {}", loginUser.getUsername(), code);
        throw new BusinessException(403, "缺少权限点：" + code
                + "；该端点已被授权管理，请联系运营端在角色权限矩阵中授予你的角色");
    }

    /**
     * 这个人<b>会被拦</b>的权限点编码 —— 整条规则只有这一处实现。
     *
     * <p>拦截器逐请求判定时问的就是这个集合，「我的权限点」接口返回的 {@code denied} 也是它，
     * 于是前端隐藏按钮的依据与服务端拒绝的依据是同一份计算结果，不可能出现
     * "按钮还在但一调就 403"或"按钮没了其实还能调"。超管恒为空集合（不把人关在门外）。</p>
     *
     * <p>代价是每个写请求多两次查询（已纳管集合 + 已持有集合），换掉的是口径漂移；
     * 写请求是按钮点击量级，不是列表轮询量级。</p>
     */
    public Set<String> deniedFor(LoginUser loginUser) {
        if (loginUser == null || isSuperAdmin(loginUser)) {
            return Set.of();
        }
        Set<String> denied = permissionService.restrictedCodes();
        denied.removeAll(permissionService.grantedCodesByUsername(loginUser.getUsername()));
        return denied;
    }

    /** 超管豁免的唯一判据（「我的权限点」接口也调它，两处不能各写一份 `*` 的比对）。 */
    public static boolean isSuperAdmin(LoginUser loginUser) {
        Set<String> permissions = loginUser.getPermissions() == null ? Set.of() : loginUser.getPermissions();
        if (permissions.contains("*")) {
            return true;
        }
        Set<String> roles = loginUser.getRoles() == null ? Set.of() : loginUser.getRoles();
        return roles.contains("SUPER_ADMIN");
    }

    private static String bestMatchingPattern(HttpServletRequest request) {
        Object attr = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return attr instanceof String text ? text : null;
    }
}
