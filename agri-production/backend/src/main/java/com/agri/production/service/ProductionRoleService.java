package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.ProductionRole;
import com.agri.production.entity.TeamMember;
import com.agri.production.mapper.ProductionRoleMapper;
import com.agri.production.mapper.TeamMemberMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 主体级角色与权限。
 *
 * <p>角色表用 tenant_id（当前经营主体 ID）隔离；同一账号切换主体后，
 * 只能看到并修改该主体自己的角色与权限。</p>
 */
@Service
@RequiredArgsConstructor
public class ProductionRoleService {

    private static final List<String> DATA_SCOPES = List.of("SELF", "PLOT", "FARM", "TENANT");
    private static final Pattern PERMISSION_CODE =
            Pattern.compile("^[a-z][a-z0-9]*\\.[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$");

    private static final List<DefaultRole> DEFAULT_ROLES = List.of(
            new DefaultRole("FARM_OWNER", "农场主", "主体经营者，拥有主体内全部数据权限", "TENANT"),
            new DefaultRole("TENANT_ADMIN", "主体管理员", "负责账号开通、角色分配与系统配置", "TENANT"),
            new DefaultRole("FARM_MANAGER", "农场管理员", "负责单农场任务派发、验收与日常运营", "FARM"),
            new DefaultRole("AGRONOMIST", "农艺师", "负责种植方案、SOP 与病虫害防治指导", "FARM"),
            new DefaultRole("WORKER", "作业员工", "执行生产任务并登记作业记录", "PLOT"),
            new DefaultRole("FINANCE", "财务人员", "查看成本、产量与经营报表", "TENANT"),
            new DefaultRole("INSPECTOR", "质检员", "负责质量检测与采样记录", "FARM"),
            new DefaultRole("OPERATOR", "作业操作员", "执行现场作业与设备操作", "PLOT"),
            new DefaultRole("OWNER", "负责人", "历史主体负责人角色", "TENANT")
    );

    private final ProductionRoleMapper roleMapper;
    private final TeamMemberMapper memberMapper;
    private final ObjectMapper objectMapper;

    /** 当前主体全部角色及在职人数。 */
    @Transactional(rollbackFor = Exception.class)
    public List<RoleView> list(String tenantId) {
        requireTenant(tenantId);
        ensureDefaults(tenantId);
        Map<String, Integer> counts = headcount(tenantId);
        return roleMapper.selectList(new LambdaQueryWrapper<ProductionRole>()
                        .eq(ProductionRole::getTenantId, tenantId)
                        .eq(ProductionRole::getStatus, 1)
                        .orderByAsc(ProductionRole::getBuiltIn)
                        .orderByAsc(ProductionRole::getRoleCode))
                .stream()
                .map(role -> view(role, counts.getOrDefault(role.getRoleCode(), 0)))
                .toList();
    }

    /** 保存某一主体的角色权限与数据范围。 */
    @Transactional(rollbackFor = Exception.class)
    public RoleView savePermissions(String tenantId, String roleId, List<String> permissions, String dataScope) {
        requireTenant(tenantId);
        ProductionRole role = requireRole(tenantId, roleId);
        String scope = normalizeScope(dataScope);
        List<String> codes = normalizePermissions(permissions);
        try {
            role.setPermissions(objectMapper.writeValueAsString(codes));
        } catch (Exception e) {
            throw new BusinessException(400, "权限数据格式不正确");
        }
        role.setDataScope(scope);
        role.setUpdateTime(LocalDateTime.now());
        roleMapper.updateById(role);
        return view(role, headcount(tenantId).getOrDefault(role.getRoleCode(), 0));
    }

    /** 成员分配角色时校验：角色必须在当前主体内存在且启用。 */
    @Transactional(rollbackFor = Exception.class)
    public void requireRoleCode(String tenantId, String roleCode) {
        String code = trim(roleCode);
        if (code == null) {
            return;
        }
        requireTenant(tenantId);
        ensureDefaults(tenantId);
        Long count = roleMapper.selectCount(new LambdaQueryWrapper<ProductionRole>()
                .eq(ProductionRole::getTenantId, tenantId)
                .eq(ProductionRole::getRoleCode, code.toUpperCase(Locale.ROOT))
                .eq(ProductionRole::getStatus, 1));
        if (count == null || count == 0) {
            throw new BusinessException(400, "角色不属于当前主体：" + code);
        }
    }

    private ProductionRole requireRole(String tenantId, String roleId) {
        if (roleId == null || roleId.isBlank()) {
            throw new BusinessException(400, "缺少角色编号");
        }
        ProductionRole role = roleMapper.selectOne(new LambdaQueryWrapper<ProductionRole>()
                .eq(ProductionRole::getTenantId, tenantId)
                .eq(ProductionRole::getRoleId, roleId.trim())
                .last("LIMIT 1"));
        if (role == null) {
            throw new BusinessException(404, "角色不存在或不属于当前主体");
        }
        return role;
    }

    private void ensureDefaults(String tenantId) {
        Set<String> existing = new LinkedHashSet<>(roleMapper.selectList(
                        new LambdaQueryWrapper<ProductionRole>()
                                .eq(ProductionRole::getTenantId, tenantId))
                .stream().map(ProductionRole::getRoleCode).toList());
        for (DefaultRole definition : DEFAULT_ROLES) {
            if (existing.contains(definition.code())) {
                continue;
            }
            ProductionRole role = new ProductionRole();
            role.setRoleId("ROLE" + UUID.randomUUID().toString().replace("-", "").substring(0, 28));
            role.setTenantId(tenantId);
            role.setRoleCode(definition.code());
            role.setRoleName(definition.name());
            role.setDescription(definition.description());
            role.setPermissions("[]");
            role.setDataScope(definition.dataScope());
            role.setBuiltIn(1);
            role.setStatus(1);
            role.setCreateTime(LocalDateTime.now());
            role.setUpdateTime(LocalDateTime.now());
            try {
                roleMapper.insert(role);
            } catch (DuplicateKeyException ignored) {
                // 并发首次打开时由另一请求完成初始化。
            }
        }
    }

    private Map<String, Integer> headcount(String tenantId) {
        QueryWrapper<TeamMember> query = new QueryWrapper<>();
        query.select("role_code", "COUNT(*) AS member_count")
                .eq("tenant_id", tenantId)
                .eq("status", 1)
                .isNotNull("role_code")
                .ne("role_code", "")
                .groupBy("role_code");
        Map<String, Integer> result = new LinkedHashMap<>();
        for (Map<String, Object> row : memberMapper.selectMaps(query)) {
            Object code = row.getOrDefault("role_code", row.get("roleCode"));
            Object count = row.getOrDefault("member_count", row.get("memberCount"));
            if (code != null) {
                result.put(String.valueOf(code), count instanceof Number number ? number.intValue() : 0);
            }
        }
        return result;
    }

    private RoleView view(ProductionRole role, int memberCount) {
        return new RoleView(role.getRoleId(), role.getRoleCode(), role.getRoleName(),
                role.getDescription(), parsePermissions(role.getPermissions()), role.getDataScope(),
                Integer.valueOf(1).equals(role.getBuiltIn()), memberCount);
    }

    private List<String> parsePermissions(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() { });
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<String> normalizePermissions(List<String> permissions) {
        if (permissions == null) {
            return List.of();
        }
        if (permissions.size() > 500) {
            throw new BusinessException(400, "权限点数量不能超过 500");
        }
        List<String> result = new ArrayList<>();
        for (String raw : permissions) {
            String code = trim(raw);
            if (code == null) {
                continue;
            }
            if (!PERMISSION_CODE.matcher(code).matches()) {
                throw new BusinessException(400, "权限编码格式不正确：" + code);
            }
            if (!result.contains(code)) {
                result.add(code);
            }
        }
        return result;
    }

    private String normalizeScope(String value) {
        String scope = trim(value);
        if (scope == null) {
            return "TENANT";
        }
        String normalized = scope.toUpperCase(Locale.ROOT);
        if (!DATA_SCOPES.contains(normalized)) {
            throw new BusinessException(400, "数据范围只能是 SELF、PLOT、FARM 或 TENANT");
        }
        return normalized;
    }

    private void requireTenant(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(403, "当前账号没有有效的经营主体");
        }
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record DefaultRole(String code, String name, String description, String dataScope) {
    }

    public record RoleView(String roleId, String roleCode, String roleName, String description,
                           List<String> permissions, String dataScope, boolean builtIn, int memberCount) {
    }
}
