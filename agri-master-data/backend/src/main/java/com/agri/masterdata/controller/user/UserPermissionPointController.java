package com.agri.masterdata.controller.user;

import com.agri.common.entity.ApiResponse;
import com.agri.common.security.LoginUser;
import com.agri.common.security.LoginUserHolder;
import com.agri.common.security.PermissionPointGuard;
import com.agri.masterdata.entity.PermissionRequest;
import com.agri.masterdata.service.IPermissionRequestService;
import com.agri.masterdata.service.IPermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 企业端「我的权限点」。
 *
 * <p>为什么不能复用运营端那个 {@code /admin/masterdata/permission/mine}：那条前缀在
 * {@code platform.rbac.operator-paths} 里，读它要求 {@code masterdata:read} —— 主体侧账号
 * 本来就没有运营端权限码，页面一打开就 403，按钮隐藏逻辑等于拿不到输入。
 * 企业端的读接口必须和它要保护的那些 {@code /api/user/**} 写接口待在同一层（只验登录）。</p>
 *
 * <p>出参里的 {@code denied} 由 {@link PermissionPointGuard#deniedFor(LoginUser)} 直接给出 ——
 * 与服务端拦截用的是同一个方法。前端只做"这个编码在不在 denied 里"一次成员判断，
 * 不复刻任何规则；否则迟早出现"按钮还在但一调就 403"。</p>
 */
@Tag(name = "企业端 · 我的权限点")
@RestController
@RequestMapping("/api/user/permission-points")
@RequiredArgsConstructor
public class UserPermissionPointController {

    private final IPermissionService permissionService;
    private final PermissionPointGuard permissionPointGuard;
    private final IPermissionRequestService permissionRequestService;

    @Operation(summary = "当前账号会被权限点拦下的写操作")
    @GetMapping("/mine")
    public ApiResponse<Map<String, Object>> mine() {
        LoginUser loginUser = LoginUserHolder.getLoginUser();
        String username = loginUser == null ? "" : loginUser.getUsername();
        boolean superAdmin = PermissionPointGuard.isSuperAdmin(loginUser);
        Map<String, Object> result = new HashMap<>();
        result.put("username", username);
        result.put("localUserId", permissionService.localUserIdByUsername(username));
        result.put("superAdmin", superAdmin);
        result.put("granted", superAdmin || loginUser == null ? List.of()
                : List.copyOf(permissionService.grantedCodesByUsername(username)));
        result.put("denied", List.copyOf(permissionPointGuard.deniedFor(loginUser)));
        // 已经提过申请的点：横幅要能说"在排队了"，而不是让人反复点同一个按钮
        result.put("pending", permissionRequestService.pendingCodesOf(username));
        return ApiResponse.success(result);
    }

    /**
     * 提交一条授权申请。
     *
     * <p>申请人身份<b>只从令牌取</b>，不接受请求体里传用户名 —— 否则任何人都能替别人申请，
     * 处理人看到的"申请人"就成了可伪造字段。</p>
     */
    @Operation(summary = "申请一个被收紧的权限点")
    @PostMapping("/requests")
    public ApiResponse<PermissionRequest> submit(@RequestBody(required = false) Map<String, String> body) {
        LoginUser loginUser = LoginUserHolder.getLoginUser();
        if (loginUser == null) {
            throw new com.agri.common.exception.BusinessException(401, "取不到申请人身份，无法提交申请");
        }
        Map<String, String> payload = body == null ? Map.of() : body;
        return ApiResponse.success(permissionRequestService.submit(
                loginUser.getUsername(),
                loginUser.getNickname(),
                payload.get("permCode"),
                payload.get("reason"),
                payload.get("pagePath"),
                loginUser.getTenantId()));
    }
}
