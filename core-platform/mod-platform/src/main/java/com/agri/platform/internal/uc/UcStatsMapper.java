package com.agri.platform.internal.uc;

import com.baomidou.mybatisplus.annotation.InterceptorIgnore;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 用户中心运营端的聚合查询。
 *
 * <p>为什么单独一个 Mapper 而不是塞进各自的实体 Mapper：这些都是**跨表统计**，
 * 没有对应的实体，放实体 Mapper 里会让"一个 Mapper 只服务一个聚合根"的边界糊掉。</p>
 *
 * <p><b>为什么绕过市场隔离</b>：用户中心运营端看的是**全平台**口径。
 * 若按登录账号的 market_id 过滤，超级管理员换个市场登录就会看到"用户凭空少了一半"。</p>
 */
@Mapper
@InterceptorIgnore(tenantLine = "true")
public interface UcStatsMapper {

    /** 按日统计新增注册。 */
    @Select("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM platform_user "
            + "WHERE deleted = 0 AND created_at >= #{from} GROUP BY DATE(created_at) ORDER BY d")
    List<Map<String, Object>> countUsersByDay(@Param("from") LocalDateTime from);

    /** 按日统计新增实名。注意：本表没有 deleted 列（无逻辑删除），不能照抄用户表的写法。 */
    @Select("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM platform_user_identity "
            + "WHERE created_at >= #{from} GROUP BY DATE(created_at) ORDER BY d")
    List<Map<String, Object>> countIdentitiesByDay(@Param("from") LocalDateTime from);

    /** 实名状态分布。同上，本表无 deleted 列。 */
    @Select("SELECT status, COUNT(*) AS c FROM platform_user_identity GROUP BY status")
    List<Map<String, Object>> identityStatusCount();

    /** 角色（身份）分布：一个用户多角色会重复计数，用于"身份实例"口径。 */
    @Select("SELECT r.code AS code, r.name AS name, COUNT(ur.user_id) AS c "
            + "FROM platform_role r LEFT JOIN platform_user_role ur ON ur.role_id = r.id "
            + "GROUP BY r.id, r.code, r.name ORDER BY c DESC")
    List<Map<String, Object>> roleDistribution();

    /** 组织类型分布。 */
    @Select("SELECT COALESCE(type, 'unknown') AS type, COUNT(*) AS c FROM platform_merchant "
            + "WHERE deleted = 0 GROUP BY COALESCE(type, 'unknown') ORDER BY c DESC")
    List<Map<String, Object>> merchantTypeDistribution();

    /** 组织认证状态分布。 */
    @Select("SELECT COALESCE(verify_status, 'none') AS status, COUNT(*) AS c FROM platform_merchant "
            + "WHERE deleted = 0 GROUP BY COALESCE(verify_status, 'none')")
    List<Map<String, Object>> merchantVerifyDistribution();

    /** 按日统计操作日志量（可指定动作前缀，如 login 表示登录）。 */
    @Select("<script>SELECT DATE(created_at) AS d, COUNT(*) AS c FROM platform_user_operation_log "
            + "WHERE deleted = 0 AND created_at >= #{from} "
            + "<if test=\"actionLike != null\">AND action LIKE CONCAT(#{actionLike}, '%')</if> "
            + "GROUP BY DATE(created_at) ORDER BY d</script>")
    List<Map<String, Object>> countLogsByDay(@Param("from") LocalDateTime from,
                                             @Param("actionLike") String actionLike);

    /** 按动作 + 结果统计日志。 */
    @Select("SELECT action, result, COUNT(*) AS c FROM platform_user_operation_log "
            + "WHERE deleted = 0 AND created_at >= #{from} GROUP BY action, result")
    List<Map<String, Object>> actionResultCount(@Param("from") LocalDateTime from);

    /** 登录失败次数 Top IP，用于撞库/异常登录识别。 */
    @Select("SELECT ip, COUNT(*) AS c FROM platform_user_operation_log "
            + "WHERE deleted = 0 AND result = 'fail' AND ip IS NOT NULL AND created_at >= #{from} "
            + "GROUP BY ip ORDER BY c DESC LIMIT 10")
    List<Map<String, Object>> failedLoginByIp(@Param("from") LocalDateTime from);

    /** 近 N 天活跃用户数（有操作日志的独立用户）。 */
    @Select("SELECT COUNT(DISTINCT user_id) FROM platform_user_operation_log "
            + "WHERE deleted = 0 AND created_at >= #{from}")
    long activeUsers(@Param("from") LocalDateTime from);

    /** 按日统计新增组织。 */
    @Select("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM platform_merchant "
            + "WHERE deleted = 0 AND created_at >= #{from} GROUP BY DATE(created_at) ORDER BY d")
    List<Map<String, Object>> countMerchantsByDay(@Param("from") LocalDateTime from);

    /** 组织所在地区 Top N（按地址前缀粗分，用于地区分布）。 */
    @Select("SELECT SUBSTRING_INDEX(COALESCE(address, '未填写'), ' ', 1) AS region, COUNT(*) AS c "
            + "FROM platform_merchant WHERE deleted = 0 GROUP BY region ORDER BY c DESC LIMIT 12")
    List<Map<String, Object>> merchantRegionDistribution();
}
