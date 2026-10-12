package com.agri.admin.service;

import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.admin.vo.OperationLogVO;
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

    /**
     * 权限变更记录：权限审计模块（角色增删改）的操作留痕。
     *
     * <p>业务含义是"谁改了角色"，而不是"某次改动的字段前后值"。仓库里没有存前后值的表
     * （没有权限变更快照），所以 {@link PermissionChangeLogVO} 中的
     * {@code beforeValue / afterValue} 恒为 null，页面要显示就得按"未接入"处理。</p>
     */
    PageResult<PermissionChangeLogVO> getChangeLogs(Integer pageNum, Integer pageSize, String changeType, String operator, String startTime, String endTime);

    List<PermissionStatisticsVO.AnomalyItem> getAnomalies();

    PermissionStatisticsVO getStatistics(String tenantId);

    /**
     * 操作日志分页查询。
     *
     * <p>参数名与前端页面对齐：{@code keyword} 同时匹配操作人与操作描述，
     * {@code operationType} 是页面上那组 create / update / delete / other。
     * 原先签名收的是 {@code operator} + {@code module}，而页面发的是
     * {@code keyword} + {@code operationType} —— 参数名对不上，Spring 直接忽略，
     * 表现就是"搜索框输了字点搜索，结果毫无变化"。</p>
     */
    PageResult<OperationLogVO> getOperationLogs(Integer pageNum, Integer pageSize, String keyword, String operationType, String module, String startTime, String endTime);

    byte[] exportChangeLogs(String changeType, String startTime, String endTime);
}
