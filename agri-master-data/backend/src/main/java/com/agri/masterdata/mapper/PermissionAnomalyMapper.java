package com.agri.masterdata.mapper;

import com.agri.admin.vo.AnomalyFinding;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.masterdata.entity.PermissionAnomaly;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 权限巡检结果的读写（{@code agri_md_permission_anomaly}）。
 *
 * <p>五条发现查询 = 页面上那四条口径（重复与幽灵合用一条规则、两个查询）。
 * 每条查询都只读真实授权关系，判定口径写在 XML 里逐条注释 ——
 * 审计结论要能被复核，就得能一眼看出它是从哪几列算出来的。</p>
 */
@Mapper
public interface PermissionAnomalyMapper extends BaseMapper<PermissionAnomaly> {

    /** 权限过大：账号（含其全部角色）可见菜单数达到阈值。 */
    List<AnomalyFinding> selectOverPrivilegedUsers(@Param("threshold") int threshold);

    /** 互斥角色：同一账号同时持有 agri_md_role_mutex 里的一对角色。 */
    List<AnomalyFinding> selectMutexRoleHolders();

    /** 过期权限：授权到期时间已过但绑定关系仍然生效（角色↔菜单、人↔角色两处）。 */
    List<AnomalyFinding> selectExpiredGrants();

    /** 重复绑定：同一 (角色, 菜单) 出现多条未删除记录。 */
    List<AnomalyFinding> selectDuplicateBindings();

    /** 幽灵绑定：绑定指向已删除或不存在的角色 / 菜单 / 账号。 */
    List<AnomalyFinding> selectOrphanBindings();

    /** 落一条发现：按 (规则, 对象类型, 对象) 去重，已存在则刷新 last_seen 并重新打开。 */
    int upsertFinding(@Param("item") PermissionAnomaly item);

    /** 扫描开始时先把全部未处置置为已处置；本轮又被发现的由 upsert 重新打开。 */
    int resolveAllOpen();

    /** 本次扫描新消解的条数（不含随后又被打开的）。 */
    int countNewlyResolved(@Param("since") LocalDateTime since);

    /** 列表（页面读它）：status 为空时默认只看未处置的。 */
    List<PermissionAnomaly> selectByStatus(@Param("status") String status, @Param("limit") int limit);

    /** 上次扫描时间 = 结果里最近的 last_seen；一条都没有时为 null（页面如实显示"尚未扫描"）。 */
    LocalDateTime selectLastScanAt();

    /** 按角色的真实聚合（人数 + 绑定菜单数），不再返回空数组。 */
    List<PermissionStatisticsVO.RoleDistribution> selectRoleDistribution(@Param("tenantId") String tenantId);

    /** 近 N 天的真实趋势：角色创建数、权限变更数、人↔角色授权数（都来自各自表的 create_time）。 */
    List<PermissionStatisticsVO.PermissionTrend> selectTrends(@Param("days") int days);
}
