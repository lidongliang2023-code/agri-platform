package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Permission;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

/**
 * 权限点目录。
 *
 * <p>这里以前声明了三个自定义查询（selectByParentId / selectByRoleId / selectAllPermissions）
 * 却没有对应的 XML —— MyBatis 在运行期抛 "Invalid bound statement (not found)"，
 * 而没有任何编译期提示。现在自定义查询只剩下面两条，且都写成注解 SQL：
 * 不依赖 XML，就不可能再出现"声明了没实现"。</p>
 */
@Mapper
public interface PermissionMapper extends BaseMapper<Permission> {

    /**
     * 按编码取点，<b>含已下线（del_flag=1）的行</b>。
     *
     * <p>BaseMapper 的查询被全局逻辑删除过滤成只看 del_flag=0，同步端点因此看不见自己上次下线的那条，
     * 于是走 INSERT —— 撞上 {@code uk_perm_code} 唯一键，一次同步整个回滚。目录必须能"复活"自己的历史行。</p>
     */
    @Select("SELECT * FROM agri_md_permission WHERE perm_code = #{permCode} LIMIT 1")
    Permission selectAnyByCode(@Param("permCode") String permCode);

    /** 把已下线的点改回在册状态并刷新元数据（逻辑删除实体的 {@code updateById} 会附加 {@code del_flag=0}，改不动这一行）。 */
    @Update("UPDATE agri_md_permission SET perm_name = #{permName}, perm_type = 'API', api_path = #{apiPath}, "
            + "http_method = #{httpMethod}, module = #{module}, status = 0, del_flag = 0, update_time = #{updateTime} "
            + "WHERE id = #{id}")
    int revive(@Param("id") Long id, @Param("permName") String permName, @Param("apiPath") String apiPath,
               @Param("httpMethod") String httpMethod, @Param("module") String module,
               @Param("updateTime") LocalDateTime updateTime);

    /** 下线一个点（代码里已无此端点）。同样写成显式 SQL，不依赖框架是否把逻辑删除列放进 update 的 SET 里。 */
    @Update("UPDATE agri_md_permission SET del_flag = 1, update_time = #{updateTime} "
            + "WHERE id = #{id} AND del_flag = 0")
    int retire(@Param("id") Long id, @Param("updateTime") LocalDateTime updateTime);

    /**
     * 已纳管的权限点编码（被任意角色持有）。
     *
     * <p>"已纳管"这条事实的入口只有这一个（消费方 {@code PermissionPointGuard.deniedFor}）：
     * 逐条问会退化成 N 次查询，两处各写一遍就是口径漂移的开始。</p>
     */
    @Select("SELECT p.perm_code FROM agri_md_permission p "
            + "JOIN agri_md_role_permission rp ON rp.perm_id = p.id "
            + "WHERE p.del_flag = 0 AND rp.del_flag = 0 GROUP BY p.perm_code")
    java.util.List<String> selectRestrictedCodes();
}
