package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.entity.RolePermission;
import com.agri.masterdata.entity.UserRole;
import com.agri.masterdata.mapper.PermissionMapper;
import com.agri.masterdata.mapper.RolePermissionMapper;
import com.agri.masterdata.mapper.UserRoleMapper;
import com.agri.masterdata.service.IPermissionService;
import com.agri.masterdata.vo.PermissionVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements IPermissionService {

    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final UserRoleMapper userRoleMapper;

    private static final Map<String, String> PERMISSION_TYPE_MAP = Map.of(
            "menu", "菜单权限",
            "action", "功能权限",
            "data", "数据权限"
    );

    private static final Map<String, String> STATUS_MAP = Map.of(
            "enabled", "启用",
            "disabled", "停用"
    );

    @Override
    public List<PermissionVO> getPermissionTree() {
        List<Permission> permissions = permissionMapper.selectAllPermissions();
        return buildTree(permissions, null);
    }

    @Override
    public PermissionVO getById(String permissionId) {
        Permission permission = permissionMapper.selectById(permissionId);
        if (permission == null) {
            throw new BusinessException("权限不存在");
        }
        return convertToVO(permission);
    }

    @Override
    public List<PermissionVO> getRolePermissions(String roleId) {
        List<Permission> permissions = permissionMapper.selectByRoleId(roleId);
        return permissions.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void assignRolePermissions(String roleId, List<String> permissionIds) {
        rolePermissionMapper.deleteByRoleId(roleId);

        for (String permissionId : permissionIds) {
            RolePermission rolePermission = new RolePermission();
            rolePermission.setRoleId(roleId);
            rolePermission.setPermissionId(permissionId);
            rolePermission.setCreateTime(LocalDateTime.now());
            rolePermissionMapper.insert(rolePermission);
        }
    }

    @Override
    public boolean checkPermission(String userId, String permissionCode) {
        List<Permission> permissions = getUserPermissions(userId);
        return permissions.stream()
                .anyMatch(p -> permissionCode.equals(p.getPermissionCode()));
    }

    @Override
    public List<Permission> getUserPermissions(String userId) {
        LambdaQueryWrapper<UserRole> userRoleWrapper = new LambdaQueryWrapper<>();
        userRoleWrapper.eq(UserRole::getUserId, Long.parseLong(userId));
        List<UserRole> userRoles = userRoleMapper.selectList(userRoleWrapper);

        List<Long> roleIds = userRoles.stream()
                .map(UserRole::getRoleId)
                .collect(Collectors.toList());

        if (roleIds.isEmpty()) {
            return new ArrayList<>();
        }

        LambdaQueryWrapper<RolePermission> rpWrapper = new LambdaQueryWrapper<>();
        rpWrapper.in(RolePermission::getRoleId, roleIds.stream().map(String::valueOf).collect(Collectors.toList()));
        List<RolePermission> rolePermissions = rolePermissionMapper.selectList(rpWrapper);

        List<String> permissionIds = rolePermissions.stream()
                .map(RolePermission::getPermissionId)
                .collect(Collectors.toList());

        if (permissionIds.isEmpty()) {
            return new ArrayList<>();
        }

        LambdaQueryWrapper<Permission> permissionWrapper = new LambdaQueryWrapper<>();
        permissionWrapper.in(Permission::getPermissionId, permissionIds);
        return permissionMapper.selectList(permissionWrapper);
    }

    private List<PermissionVO> buildTree(List<Permission> permissions, String parentId) {
        List<PermissionVO> tree = new ArrayList<>();
        for (Permission perm : permissions) {
            if ((parentId == null && perm.getParentId() == null) ||
                    (parentId != null && parentId.equals(perm.getParentId()))) {
                PermissionVO vo = convertToVO(perm);
                vo.setChildren(buildTree(permissions, perm.getPermissionId()));
                tree.add(vo);
            }
        }
        tree.sort((a, b) -> {
            if (a.getSortOrder() == null) return 1;
            if (b.getSortOrder() == null) return -1;
            return a.getSortOrder().compareTo(b.getSortOrder());
        });
        return tree;
    }

    private PermissionVO convertToVO(Permission entity) {
        PermissionVO vo = new PermissionVO();
        vo.setPermissionId(entity.getPermissionId());
        vo.setPermissionCode(entity.getPermissionCode());
        vo.setPermissionName(entity.getPermissionName());
        vo.setPermissionType(entity.getPermissionType());
        vo.setPermissionTypeName(PERMISSION_TYPE_MAP.getOrDefault(entity.getPermissionType(), entity.getPermissionType()));
        vo.setParentId(entity.getParentId());
        vo.setPermissionPath(entity.getPermissionPath());
        vo.setPermissionIcon(entity.getPermissionIcon());
        vo.setPermissionUrl(entity.getPermissionUrl());
        vo.setComponent(entity.getComponent());
        vo.setSortOrder(entity.getSortOrder());
        vo.setStatus(entity.getStatus());
        vo.setStatusName(STATUS_MAP.getOrDefault(entity.getStatus(), entity.getStatus()));
        vo.setCreateTime(entity.getCreateTime());
        return vo;
    }
}