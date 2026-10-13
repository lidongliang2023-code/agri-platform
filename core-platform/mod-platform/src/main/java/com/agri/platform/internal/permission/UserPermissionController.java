package com.agri.platform.internal.permission;

import com.agri.core.infra.util.JsonUtil;
import com.agri.core.infra.web.MarketContext;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
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

    /** 通配权限码：拥有它即拥有全部权限（SUPER_ADMIN 就是 {@code ["*"]}）。 */
    private static final String WILDCARD = "*";

    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;

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

        LambdaQueryWrapper<UserRoleEntity> wrapper = new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, userId);
        if (marketId != null) {
            wrapper.eq(UserRoleEntity::getMarketId, marketId);
        }
        List<UserRoleEntity> bindings = userRoleMapper.selectList(wrapper);

        List<String> roles = new ArrayList<>();
        LinkedHashSet<String> permissions = new LinkedHashSet<>();
        if (!bindings.isEmpty()) {
            List<Long> roleIds = bindings.stream().map(UserRoleEntity::getRoleId).toList();
            for (RoleEntity role : roleMapper.selectBatchIds(roleIds)) {
                roles.add(role.getCode());
                permissions.addAll(parsePermissions(role));
            }
        }

        Map<String, Object> view = new LinkedHashMap<>();
        view.put("userId", userId);
        view.put("marketId", marketId);
        view.put("roles", roles);
        view.put("permissions", new ArrayList<>(permissions));
        view.put("wildcard", permissions.contains(WILDCARD));
        return ApiResponse.ok(view);
    }

    /**
     * 解析角色上的权限码 JSON 数组。
     *
     * <p>存储非法（不是字符串数组）时明确失败，不静默当成"没有权限" ——
     * 后者会让一次数据错误表现成"所有人都没有权限"，很难查。</p>
     */
    private List<String> parsePermissions(RoleEntity role) {
        String json = role.getPermissions();
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> codes = JsonUtil.MAPPER.readValue(json, new TypeReference<List<String>>() {
            });
            List<String> normalized = new ArrayList<>();
            for (String code : codes == null ? List.<String>of() : codes) {
                if (code != null && !code.isBlank()) {
                    normalized.add(code.trim());
                }
            }
            return normalized;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "角色 " + role.getCode() + " 的权限存储格式非法：" + json);
        }
    }
}
