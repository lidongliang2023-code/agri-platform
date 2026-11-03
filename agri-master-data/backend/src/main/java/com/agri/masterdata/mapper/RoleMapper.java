package com.agri.masterdata.mapper;

import com.agri.masterdata.dto.RolePageDTO;
import com.agri.admin.vo.RoleSummaryVO;
import com.agri.masterdata.entity.Role;
import com.agri.masterdata.vo.RoleVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RoleMapper extends BaseMapper<Role> {

    List<RoleVO> selectRolePage(@Param("dto") RolePageDTO dto);

    long selectRoleCount(@Param("dto") RolePageDTO dto);

    RoleVO selectRoleById(@Param("id") Long id);

    List<Long> selectMenuIdsByRoleId(@Param("roleId") Long roleId);

    /** 未撤销的角色↔菜单绑定总数（统计卡"授权关系"读它；本模块没有 RoleMenuMapper，计数挂在这里）。 */
    Long countRoleMenuGrants();

    void deleteRoleMenus(@Param("roleId") Long roleId);

    void insertRoleMenu(@Param("roleId") Long roleId, @Param("menuId") Long menuId);

    Role selectByRoleCode(@Param("roleCode") String roleCode);

    List<RoleVO> selectAdminRoleList(@Param("offset") Integer offset, @Param("limit") Integer limit,
                                     @Param("keyword") String keyword, @Param("roleName") String roleName,
                                     @Param("roleType") String roleType, @Param("status") Integer status,
                                     @Param("tenantId") String tenantId, @Param("ownership") String ownership);

    long countAdminRoleList(@Param("keyword") String keyword, @Param("roleName") String roleName,
                            @Param("roleType") String roleType, @Param("status") Integer status,
                            @Param("tenantId") String tenantId, @Param("ownership") String ownership);

    RoleVO selectAdminRoleDetail(@Param("id") Long id);

    RoleSummaryVO selectAdminRoleSummary(@Param("keyword") String keyword, @Param("roleName") String roleName,
                                         @Param("roleType") String roleType, @Param("status") Integer status,
                                         @Param("tenantId") String tenantId,
                                         @Param("ownership") String ownership);
}
