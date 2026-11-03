package com.agri.admin.service;

import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.admin.vo.OperationLogVO;
import com.agri.admin.vo.OperationLogSummaryVO;
import com.agri.common.entity.PageResult;
import com.agri.admin.vo.RoleSummaryVO;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.entity.PermissionRule;
import com.agri.masterdata.vo.RoleVO;

import java.util.List;
import java.util.Map;

public interface IAdminPermissionService {

    PageResult<RoleVO> getRoleList(Integer pageNum, Integer pageSize, String keyword, String roleName,
                                   String roleType, Integer status, String tenantId, String ownership);

    RoleSummaryVO getRoleSummary(String keyword, String roleName, String roleType, Integer status,
                                 String tenantId, String ownership);

    RoleVO getRoleDetail(Long id);

    Long createRole(RoleSaveDTO dto);

    void updateRole(Long id, RoleSaveDTO dto);

    void deleteRole(Long id);

    void updateRoleStatus(Long id, Integer status);

    /**
     * 覆盖式保存角色的权限点绑定（菜单表 agri_md_menu）。
     *
     * <p>入参是"保存后应该有的全部权限点 id"，不是增量。前端切换单个单元格时也要传全量，
     * 否则后端无法区分"取消勾选"和"没传"。系统内置角色与历史角色不允许改，直接抛业务异常。</p>
     *
     * @return 实际生效的权限点数量
     */
    int assignRoleMenus(Long roleId, List<Long> menuIds);

    /**
     * 权限变更记录：权限审计模块（角色增删改）的操作留痕。
     *
     * <p>业务含义是"谁改了角色"，而不是"某次改动的字段前后值"。仓库里没有存前后值的表
     * （没有权限变更快照），所以 {@link PermissionChangeLogVO} 中的
     * {@code beforeValue / afterValue} 恒为 null，页面要显示就得按"未接入"处理。</p>
     */
    PageResult<PermissionChangeLogVO> getChangeLogs(Integer pageNum, Integer pageSize, String changeType, String operator, String startTime, String endTime);

    /**
     * 权限异常清单（巡检结果，不是硬编码空数组）。
     *
     * @param status OPEN（默认，未处置）/ RESOLVED（历史，已随授权修复自动消解）
     */
    List<PermissionStatisticsVO.AnomalyItem> getAnomalies(String status);

    /** 立刻扫描一次（页面「重新检测」与每日定时任务共用同一处实现）。 */
    Map<String, Object> scanAnomalies();

    /** 生效中的巡检规则与阈值：页面的"判定口径"表照它渲染，不再写死在模板里。 */
    List<PermissionRule> listRules();

    /** 上次扫描时间；从未扫描过时为 null，页面显示"尚未扫描"而不是编一个时间。 */
    java.time.LocalDateTime lastScanAt();

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
    PageResult<OperationLogVO> getOperationLogs(Integer pageNum, Integer pageSize, String keyword,
                                                String operationType, String module, String result,
                                                String startTime, String endTime);

    OperationLogSummaryVO getOperationLogSummary(String keyword, String operationType, String module,
                                                 String result, String startTime, String endTime);

    List<String> getOperationLogModules();

    /* ---------- 权限点（按钮级 / API 级，2026-11-02） ---------- */

    /** 目录列表；keyword 命中编码 / 名称 / 路径，module 按控制器 @Tag 分组。 */
    List<com.agri.masterdata.vo.PermissionVO> listPermissionPoints(String keyword, String module);

    /** 从当前应用的实际端点映射同步目录（幂等；代码里已消失的端点置为下线）。 */
    Map<String, Object> syncPermissionPoints();

    /** 某角色已持有的权限点 id（字符串，避免前端 Number 截断 18 位主键）。 */
    List<String> getRolePoints(Long roleId);

    /** 覆盖式保存某角色的权限点授权；内置与历史角色只读，与菜单授权同一条规则。 */
    int assignRolePoints(Long roleId, List<String> permIds);

    /** 当前调用者的权限点视图（是否超管、本地账号、已持有编码），页面用它决定按钮可见性。 */
    Map<String, Object> myPermissionPoints();

    /** 授权申请列表；status 为空按 PENDING（处理队列只看待办的，全部要靠显式传参）。 */
    List<com.agri.masterdata.entity.PermissionRequest> listPermissionRequests(String status, String keyword);

    /** 处理一条授权申请：同意即把该点授给申请人已有的角色，驳回必须写原因。 */
    Map<String, Object> handlePermissionRequest(Long id, boolean approve, String remark);

    byte[] exportChangeLogs(String changeType, String startTime, String endTime);
}
