package com.agri.platform.internal.permission;

import com.agri.core.infra.util.JsonUtil;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 用户在当前市场下的角色与权限码（RBAC 的读侧）。
 *
 * <p>两个地方要用同一份解析结果，所以抽成服务而不是各写一遍：
 * {@code /api/v1/platform/permissions/mine}（子系统实时鉴权）与
 * {@code JwtAuthFilter}（平台自身 {@code /api/v1/admin/**} 的准入）。</p>
 */
@Service
@RequiredArgsConstructor
public class UserPermissionService {

    /** 通配权限码。 */
    public static final String WILDCARD = "*";

    /**
     * 运营角色码。
     *
     * <p>与交易模块的准入口径保持一致（那里也是 SUPER_ADMIN / MARKET_OPS）。</p>
     */
    public static final Set<String> OPERATOR_ROLES = Set.of("SUPER_ADMIN", "MARKET_OPS");

    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;

    /** 解析结果。 */
    public record Resolved(Long userId, Long marketId, List<String> roles, Set<String> permissions) {

        /** 是否具备某个权限码（支持 {@code *} 与 {@code prefix:*}）。 */
        public boolean has(String code) {
            if (permissions.contains(WILDCARD)) {
                return true;
            }
            if (permissions.contains(code)) {
                return true;
            }
            int colon = code.indexOf(':');
            return colon > 0 && permissions.contains(code.substring(0, colon) + ":*");
        }

        /** 是否是运营（超管或市场运营）。 */
        public boolean isOperator() {
            if (permissions.contains(WILDCARD)) {
                return true;
            }
            return roles.stream().anyMatch(OPERATOR_ROLES::contains);
        }
    }

    /**
     * 解析某个用户在某市场下的角色与权限码。
     *
     * @param marketId 为空时不按市场过滤（取该用户全部市场的角色）
     */
    public Resolved resolve(Long userId, Long marketId) {
        List<UserRoleEntity> bindings;
        if (userId == null) {
            bindings = List.of();
        } else {
            LambdaQueryWrapper<UserRoleEntity> wrapper = new LambdaQueryWrapper<UserRoleEntity>()
                    .eq(UserRoleEntity::getUserId, userId);
            if (marketId != null) {
                wrapper.eq(UserRoleEntity::getMarketId, marketId);
            }
            bindings = userRoleMapper.selectList(wrapper);
        }

        List<String> roles = new ArrayList<>();
        Set<String> permissions = new LinkedHashSet<>();
        if (!bindings.isEmpty()) {
            List<Long> roleIds = bindings.stream().map(UserRoleEntity::getRoleId).toList();
            for (RoleEntity role : roleMapper.selectBatchIds(roleIds)) {
                roles.add(role.getCode());
                permissions.addAll(parsePermissions(role));
            }
        }
        return new Resolved(userId, marketId, roles, permissions);
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
