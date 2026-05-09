package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminPermissionService;
import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.entity.Role;
import com.agri.masterdata.mapper.RoleMapper;
import com.agri.masterdata.vo.RoleVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminPermissionServiceImpl implements IAdminPermissionService {

    private final RoleMapper roleMapper;

    @Override
    public PageResult<RoleVO> getRoleList(Integer pageNum, Integer pageSize, String roleName, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<RoleVO> list = roleMapper.selectAdminRoleList(offset, pageSize, roleName, tenantId);
        long total = roleMapper.countAdminRoleList(roleName, tenantId);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public RoleVO getRoleDetail(Long id) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        return RoleVO.fromEntity(role);
    }

    @Override
    @Transactional
    public void createRole(RoleSaveDTO dto) {
        Role role = Role.builder()
                .roleName(dto.getRoleName())
                .roleCode(dto.getRoleCode())
                .description(dto.getDescription())
                .tenantId(dto.getTenantId())
                .build();
        roleMapper.insert(role);
    }

    @Override
    @Transactional
    public void updateRole(Long id, RoleSaveDTO dto) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        role.setRoleName(dto.getRoleName());
        role.setRoleCode(dto.getRoleCode());
        role.setDescription(dto.getDescription());
        roleMapper.updateById(role);
    }

    @Override
    @Transactional
    public void deleteRole(Long id) {
        roleMapper.deleteById(id);
    }

    @Override
    public PageResult<PermissionChangeLogVO> getChangeLogs(Integer pageNum, Integer pageSize, String changeType, String operator, String startTime, String endTime) {
        int offset = (pageNum - 1) * pageSize;
        List<PermissionChangeLogVO> list = new ArrayList<>();
        long total = 0;
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public List<PermissionStatisticsVO.AnomalyItem> getAnomalies() {
        return new ArrayList<>();
    }

    @Override
    public PermissionStatisticsVO getStatistics(String tenantId) {
        return PermissionStatisticsVO.builder()
                .totalRoles(10L)
                .totalPermissions(100L)
                .anomalyCount(0L)
                .anomalies(new ArrayList<>())
                .build();
    }

    @Override
    public PageResult<PermissionChangeLogVO> getOperationLogs(Integer pageNum, Integer pageSize, String operator, String module, String startTime, String endTime) {
        int offset = (pageNum - 1) * pageSize;
        List<PermissionChangeLogVO> list = new ArrayList<>();
        long total = 0;
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public byte[] exportChangeLogs(String changeType, String startTime, String endTime) {
        return new byte[0];
    }
}