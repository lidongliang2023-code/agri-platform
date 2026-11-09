package com.agri.platform.internal.permission;

import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 平台级角色的增删改查。
 *
 * <p>领域边界：{@code platform_role} 只承载平台级角色，用户绑定关系在
 * {@code platform_user_role}。组织级角色属于主数据域 {@code agri_md_role}（tenant_id 维度），
 * 不在这个服务里创建，也不在这里与平台角色混用。菜单是前端骨架，权限码才是授权挂载点。</p>
 */
@Service
@RequiredArgsConstructor
public class RoleAdminService {

    /** 编码规则：字母开头，允许字母/数字/下划线/短横线，2-64 位 */
    private static final Pattern CODE_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9_-]{1,63}");

    /** 内置角色不允许删除或停用，避免把运营端锁死 */
    private static final Set<String> SYSTEM_ROLES = Set.of("SUPER_ADMIN", "MARKET_OPS");

    private static final String STATUS_ENABLED = "enabled";
    private static final String STATUS_DISABLED = "disabled";

    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;

    /**
     * 角色列表：回填成员数，并给历史行补默认状态/更新时间。
     */
    public List<RoleEntity> list() {
        List<RoleEntity> roles = roleMapper.selectList(
                new LambdaQueryWrapper<RoleEntity>().orderByDesc(RoleEntity::getCreatedAt));
        Map<Long, Long> bound = userRoleMapper.selectList(null).stream()
                .collect(Collectors.groupingBy(UserRoleEntity::getRoleId, Collectors.counting()));
        roles.forEach((role) -> {
            role.setMemberCount(bound.getOrDefault(role.getId(), 0L));
            if (role.getStatus() == null || role.getStatus().isBlank()) {
                role.setStatus(STATUS_ENABLED);
            }
            if (role.getUpdatedAt() == null) {
                role.setUpdatedAt(role.getCreatedAt());
            }
            if (role.getPermissions() == null || role.getPermissions().isBlank()) {
                role.setPermissions("[]");
            }
        });
        return roles;
    }

    /**
     * 新建角色：编码唯一性在落库前校验，重复直接 409，不静默覆盖。
     */
    @Transactional
    public RoleEntity create(RoleCreateRequest request) {
        String code = trim(request == null ? null : request.getCode());
        String name = trim(request == null ? null : request.getName());
        if (code == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色编码不能为空");
        }
        if (!CODE_PATTERN.matcher(code).matches()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "角色编码需以字母开头，仅允许字母、数字、下划线、短横线，长度 2-64");
        }
        if (name == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色名称不能为空");
        }
        Long exists = roleMapper.selectCount(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, code));
        if (exists != null && exists > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "角色编码已存在：" + code);
        }
        RoleEntity role = new RoleEntity();
        role.setCode(code);
        role.setName(name);
        String description = trim(request.getDescription());
        if (description != null && description.length() > 255) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色说明不能超过 255 字");
        }
        role.setDescription(description);
        role.setPermissions("[]");
        role.setStatus(STATUS_ENABLED);
        LocalDateTime now = LocalDateTime.now();
        role.setCreatedAt(now);
        role.setUpdatedAt(now);
        roleMapper.insert(role);
        role.setMemberCount(0L);
        return role;
    }

    /**
     * 编辑角色：编码不可改；停用内置角色会被拒绝。
     */
    @Transactional
    public RoleEntity update(String code, RoleUpdateRequest request) {
        RoleEntity role = requireRole(code);
        if (request == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        String name = trim(request.getName());
        if (request.getName() != null && name == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色名称不能为空");
        }
        if (name != null) {
            role.setName(name);
        }
        if (request.getDescription() != null) {
            String description = request.getDescription().trim();
            if (description.length() > 255) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "角色说明不能超过 255 字");
            }
            // 用空串而不是 null：MyBatis-Plus 默认忽略 null 字段，null 会导致"清空说明"保存不进去
            role.setDescription(description);
        }
        String status = trim(request.getStatus());
        if (status != null) {
            if (!STATUS_ENABLED.equals(status) && !STATUS_DISABLED.equals(status)) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "状态只能是 enabled 或 disabled");
            }
            if (STATUS_DISABLED.equals(status) && SYSTEM_ROLES.contains(role.getCode())) {
                throw new BusinessException(ErrorCode.BAD_REQUEST,
                        "内置角色不可停用：" + role.getCode());
            }
            role.setStatus(status);
        }
        role.setUpdatedAt(LocalDateTime.now());
        roleMapper.updateById(role);
        return withDefaults(requireRole(code));
    }

    /**
     * 删除角色：内置角色或仍被用户绑定时明确阻断，返回可读原因。
     */
    @Transactional
    public void delete(String code) {
        RoleEntity role = requireRole(code);
        if (SYSTEM_ROLES.contains(role.getCode())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "内置角色不可删除：" + role.getCode());
        }
        Long bound = userRoleMapper.selectCount(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getRoleId, role.getId()));
        if (bound != null && bound > 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "该角色仍被 " + bound + " 个用户绑定，请先解除绑定后再删除");
        }
        roleMapper.deleteById(role.getId());
    }

    private RoleEntity requireRole(String code) {
        String normalized = trim(code);
        if (normalized == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色编码不能为空");
        }
        RoleEntity role = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, normalized));
        if (role == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "角色不存在：" + normalized);
        }
        return role;
    }

    private RoleEntity withDefaults(RoleEntity role) {
        if (role.getStatus() == null || role.getStatus().isBlank()) {
            role.setStatus(STATUS_ENABLED);
        }
        if (role.getUpdatedAt() == null) {
            role.setUpdatedAt(role.getCreatedAt());
        }
        return role;
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
