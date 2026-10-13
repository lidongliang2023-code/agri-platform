package com.agri.platform.internal.permission;

import com.agri.core.infra.web.MarketContext;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 当前登录用户在本市场下的角色与权限码（子系统实时鉴权用）。
 *
 * <p><b>它解决的问题</b>：子系统的运营端此前**只有前端路由隔离** —— 任何登录用户
 * （哪怕只是个只绑了农户主体的账号）都能直接调打款、退款审核、纠纷仲裁这些写接口。
 * 架构文档 V2.0 第 5.5 节的权限模型是「RBAC 功能权限 + 数据权限 + 多租户隔离」，
 * 且明确「细权限以后端实时鉴权为准」；这张表（{@code platform_user_role} ⋈
 * {@code platform_role.permissions}）就是那套 RBAC 的落地，之前只是没人读。</p>
 *
 * <p><b>为什么做成"解析自己"而不是"传 userId 查别人"</b>：与
 * {@code /api/v1/platform/merchants/mine} 同一口径 —— 身份从令牌来，
 * 不接受参数指定查谁，否则换个 userId 就能探测别人的权限。</p>
 *
 * <p><b>为什么按市场取</b>：{@code platform_user_role} 带 {@code market_id}
 * （ADR-005 按市场隔离运营），同一个人在不同市场可以是不同角色。</p>
 */
@RestController
@RequiredArgsConstructor
public class UserPermissionController {

    private final UserPermissionService userPermissionService;

    /**
     * 当前用户在当前市场的角色与权限码。
     *
     * @return 形如 {@code {userId, marketId, roles:[...], permissions:[...]}}；
     *         没有任何角色时返回空数组（而不是报错）—— "没有权限"是正常状态，
     *         由调用方决定放不放行。
     */
    @GetMapping("/api/v1/platform/permissions/mine")
    public ApiResponse<Map<String, Object>> mine() {
        Long userId = MarketContext.currentUserId();
        Long marketId = MarketContext.currentMarketId();
        if (userId == null) {
            return ApiResponse.fail(ErrorCode.UNAUTHORIZED);
        }

        UserPermissionService.Resolved resolved = userPermissionService.resolve(userId, marketId);

        Map<String, Object> view = new LinkedHashMap<>();
        view.put("userId", resolved.userId());
        view.put("marketId", resolved.marketId());
        view.put("roles", resolved.roles());
        view.put("permissions", new ArrayList<>(resolved.permissions()));
        view.put("wildcard", resolved.permissions().contains(UserPermissionService.WILDCARD));
        view.put("operator", resolved.isOperator());
        return ApiResponse.ok(view);
    }
}
