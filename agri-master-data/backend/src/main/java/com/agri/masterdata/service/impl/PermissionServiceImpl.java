package com.agri.masterdata.service.impl;

import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.entity.RolePermission;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.entity.UserRole;
import com.agri.masterdata.mapper.PermissionMapper;
import com.agri.masterdata.mapper.RolePermissionMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.mapper.UserRoleMapper;
import com.agri.masterdata.service.IPermissionService;
import com.agri.masterdata.vo.PermissionVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 权限点目录与授权。
 *
 * <p>这个类以前是"看着像能用、一调就炸"的样子：它调的三个自定义查询（{@code selectByParentId}、
 * {@code selectByRoleId}、{@code selectAllPermissions}）在 mapper 里声明了却<b>没有对应的 XML</b>，
 * 而 {@code application.yml} 的 {@code mapper-locations} 又确实加载了那批 XML —— 所以任何调用
 * 都会抛 "Invalid bound statement"。加上实体映射的是一串写不进去的列，整条链路从未真的工作过。</p>
 *
 * <p>现在只用 MyBatis-Plus 的 BaseMapper + 条件构造器，不再留下"声明了没实现"的查询；
 * 授权关系读写的是表上真实存在的 {@code role_id / perm_id}。</p>
 */
@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements IPermissionService {

    /** 目录一次最多返回多少条（矩阵页分组显示用；超过说明端点数量异常，宁可显式截断也不静默） */
    private static final int MAX_LIST = 1000;

    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final UserRoleMapper userRoleMapper;
    private final UserMapper userMapper;

    @Override
    public List<PermissionVO> listPoints(String keyword, String module) {
        LambdaQueryWrapper<Permission> wrapper = new LambdaQueryWrapper<Permission>()
                .eq(Permission::getPermType, "API")
                .orderByAsc(Permission::getModule).orderByAsc(Permission::getApiPath).orderByAsc(Permission::getId)
                .last("LIMIT " + MAX_LIST);
        if (notBlank(module)) {
            wrapper.eq(Permission::getModule, module.trim());
        }
        if (notBlank(keyword)) {
            String kw = keyword.trim();
            wrapper.and(q -> q.like(Permission::getPermCode, kw)
                    .or().like(Permission::getPermName, kw)
                    .or().like(Permission::getApiPath, kw));
        }
        List<Permission> rows = permissionMapper.selectList(wrapper);
        Map<Long, Integer> holders = holderCountByPoint();
        return rows.stream().map(row -> toVO(row, holders)).collect(Collectors.toList());
    }

    @Override
    public List<String> pointIdsOfRole(Long roleId) {
        if (roleId == null) {
            return Collections.emptyList();
        }
        return rolePermissionMapper.selectList(new LambdaQueryWrapper<RolePermission>()
                        .eq(RolePermission::getRoleId, roleId)
                        .orderByAsc(RolePermission::getPermId))
                .stream().map(rp -> String.valueOf(rp.getPermId())).collect(Collectors.toList());
    }

    @Override
    public List<PermissionVO> pointsOfRole(Long roleId) {
        List<String> ids = pointIdsOfRole(roleId);
        if (ids.isEmpty()) {
            return Collections.emptyList();
        }
        Map<Long, Integer> holders = holderCountByPoint();
        return permissionMapper.selectList(new LambdaQueryWrapper<Permission>()
                        .in(Permission::getId, ids.stream().map(Long::valueOf).collect(Collectors.toList()))
                        .orderByAsc(Permission::getModule).orderByAsc(Permission::getApiPath))
                .stream().map(row -> toVO(row, holders)).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int assignRolePoints(Long roleId, List<String> permIds, String operator) {
        if (roleId == null) {
            throw new com.agri.common.exception.BusinessException(400, "缺少角色主键");
        }
        clearRolePoints(roleId);
        List<Long> ids = permIds == null ? Collections.emptyList() : permIds.stream()
                .filter(PermissionServiceImpl::notBlank).map(PermissionServiceImpl::toLong)
                .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
        if (ids.isEmpty()) {
            return 0;
        }
        // 只接受目录里真的存在的点：给一个不存在的 id 等于造一条永远匹配不上的授权
        long existing = permissionMapper.selectCount(new LambdaQueryWrapper<Permission>().in(Permission::getId, ids));
        if (existing != ids.size()) {
            throw new com.agri.common.exception.BusinessException(400,
                    "有 " + (ids.size() - existing) + " 个权限点不在目录里，请先同步端点目录");
        }
        LocalDateTime now = LocalDateTime.now();
        for (Long permId : ids) {
            RolePermission grant = new RolePermission();
            grant.setRoleId(roleId);
            grant.setPermId(permId);
            grant.setStatus(0);
            grant.setDelFlag(0);
            grant.setCreateTime(now);
            grant.setCreateBy(operator);
            rolePermissionMapper.insert(grant);
        }
        return ids.size();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int clearRolePoints(Long roleId) {
        if (roleId == null) {
            return 0;
        }
        // 物理删：表上有 uk_role_perm(role_id, perm_id)，逻辑删除会让旧行继续占位，
        // 于是"取消勾选 → 重新勾选"必然 Duplicate entry。判据见 RolePermissionMapper#physicalDeleteByRole。
        return rolePermissionMapper.physicalDeleteByRole(roleId);
    }

    @Override
    public Set<String> restrictedCodes() {
        return new HashSet<>(permissionMapper.selectRestrictedCodes());
    }

    @Override
    public Set<String> grantedCodesOfUser(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }
        List<Long> roleIds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>()
                        .eq(UserRole::getUserId, userId))
                .stream().map(UserRole::getRoleId).filter(java.util.Objects::nonNull).distinct()
                .collect(Collectors.toList());
        if (roleIds.isEmpty()) {
            return new HashSet<>();
        }
        List<Long> permIds = rolePermissionMapper.selectList(new LambdaQueryWrapper<RolePermission>()
                        .in(RolePermission::getRoleId, roleIds))
                .stream().map(RolePermission::getPermId).filter(java.util.Objects::nonNull).distinct()
                .collect(Collectors.toList());
        if (permIds.isEmpty()) {
            return new HashSet<>();
        }
        return permissionMapper.selectList(new LambdaQueryWrapper<Permission>().in(Permission::getId, permIds))
                .stream().map(Permission::getPermCode).collect(Collectors.toCollection(HashSet::new));
    }

    @Override
    public PermissionVO pointByCode(String permCode) {
        return toVO(findByCode(permCode), holderCountByPoint());
    }

    @Override
    public Long localUserIdByUsername(String username) {
        if (!notBlank(username)) {
            return null;
        }
        List<User> users = userMapper.selectList(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username.trim()).last("LIMIT 1"));
        User local = users.isEmpty() ? null : users.get(0);
        if (local == null || local.getId() == null) {
            return null;
        }
        // 账号存在但一个角色都没绑 = 没有本地身份，与"没这个账号"同义
        long bound = userRoleMapper.selectCount(new LambdaQueryWrapper<UserRole>().eq(UserRole::getUserId, local.getId()));
        return bound > 0 ? local.getId() : null;
    }

    @Override
    public Set<String> grantedCodesByUsername(String username) {
        return grantedCodesOfUser(localUserIdByUsername(username));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int grantCodeToUserRoles(String username, String permCode, String operator) {
        Permission point = findByCode(permCode);
        if (point == null) {
            throw new com.agri.common.exception.BusinessException(400,
                    "权限点不存在或已下线：" + permCode + "；请先在运营端同步端点目录");
        }
        Long userId = localUserIdByUsername(username);
        if (userId == null) {
            // 授权只存在于"角色 ↔ 权限点"这一层，账号没有授权位；一个角色都没绑就无法给他授权
            throw new com.agri.common.exception.BusinessException(400,
                    "账号 " + username + " 在本模块还没有绑定任何角色，无法授权；"
                            + "请先在「角色与权限」里给他分配一个角色，再处理这条申请");
        }
        List<Long> roleIds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>()
                        .eq(UserRole::getUserId, userId))
                .stream().map(UserRole::getRoleId).filter(java.util.Objects::nonNull).distinct()
                .collect(Collectors.toList());
        if (roleIds.isEmpty()) {
            throw new com.agri.common.exception.BusinessException(400,
                    "账号 " + username + " 没有绑定任何角色，无法授权");
        }
        LocalDateTime now = LocalDateTime.now();
        int granted = 0;
        for (Long roleId : roleIds) {
            long exists = rolePermissionMapper.selectCount(new LambdaQueryWrapper<RolePermission>()
                    .eq(RolePermission::getRoleId, roleId).eq(RolePermission::getPermId, point.getId()));
            if (exists > 0) {
                continue;
            }
            RolePermission grant = new RolePermission();
            grant.setRoleId(roleId);
            grant.setPermId(point.getId());
            grant.setStatus(0);
            grant.setDelFlag(0);
            grant.setCreateTime(now);
            grant.setCreateBy(operator);
            rolePermissionMapper.insert(grant);
            granted += 1;
        }
        return granted;
    }

    private Permission findByCode(String permCode) {
        if (!notBlank(permCode)) {
            return null;
        }
        return permissionMapper.selectOne(new LambdaQueryWrapper<Permission>()
                .eq(Permission::getPermCode, permCode.trim()).last("LIMIT 1"));
    }

    /** 一次分组查询拿到"每个点被多少个角色持有"，避免 N+1。 */
    private Map<Long, Integer> holderCountByPoint() {
        List<Map<String, Object>> rows = rolePermissionMapper.selectMaps(new QueryWrapper<RolePermission>()
                .select("perm_id AS permId", "COUNT(*) AS cnt").groupBy("perm_id"));
        Map<Long, Integer> result = new java.util.HashMap<>();
        for (Map<String, Object> row : rows) {
            Long permId = toLong(String.valueOf(row.get("permId")));
            Integer cnt = row.get("cnt") == null ? 0 : Integer.parseInt(String.valueOf(row.get("cnt")));
            if (permId != null) {
                result.put(permId, cnt);
            }
        }
        return result;
    }

    private PermissionVO toVO(Permission row, Map<Long, Integer> holders) {
        if (row == null) {
            return null;
        }
        PermissionVO vo = new PermissionVO();
        vo.setId(String.valueOf(row.getId()));
        vo.setPermCode(row.getPermCode());
        vo.setPermName(row.getPermName());
        vo.setPermType(row.getPermType());
        vo.setApiPath(row.getApiPath());
        vo.setHttpMethod(row.getHttpMethod());
        vo.setModule(row.getModule());
        vo.setStatus(row.getStatus());
        vo.setRemark(row.getRemark());
        int roleCount = holders.getOrDefault(row.getId(), 0);
        vo.setRoleCount(roleCount);
        vo.setGranted(roleCount > 0);
        return vo;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static Long toLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 预留：目录为空时给调用方一个可判定的空集合，而不是 null。 */
    static List<PermissionVO> emptyList() {
        return new ArrayList<>();
    }
}
