package com.agri.admin.service;

import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.vo.RoleVO;

import java.util.List;

public interface IAdminPermissionService {

    PageResult<RoleVO> getRoleList(Integer pageNum, Integer pageSize, String roleName, String tenantId);

    RoleVO getRoleDetail(Long id);

    void createRole(RoleSaveDTO dto);

    void updateRole(Long id, RoleSaveDTO dto);

    void deleteRole(Long id);

    PageResult<PermissionChangeLogVO> getChangeLogs(Integer pageNum, Integer pageSize, String changeType, String operator, String startTime, String endTime);

    List<PermissionStatisticsVO.AnomalyItem> getAnomalies();

    PermissionStatisticsVO getStatistics(String tenantId);

    PageResult<PermissionChangeLogVO> getOperationLogs(Integer pageNum, Integer pageSize, String operator, String module, String startTime, String endTime);

    byte[] exportChangeLogs(String changeType, String startTime, String endTime);
}