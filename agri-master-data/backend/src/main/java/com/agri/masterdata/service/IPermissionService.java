package com.agri.masterdata.service;

import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.vo.PermissionVO;

import java.util.List;

public interface IPermissionService {

    List<PermissionVO> getPermissionTree();

    PermissionVO getById(String permissionId);

    List<PermissionVO> getRolePermissions(String roleId);

    void assignRolePermissions(String roleId, List<String> permissionIds);

    boolean checkPermission(String userId, String permissionCode);

    List<Permission> getUserPermissions(String userId);
}