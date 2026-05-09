package com.agri.masterdata.mapper;

import com.agri.masterdata.dto.RolePageDTO;
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

    void deleteRoleMenus(@Param("roleId") Long roleId);

    void insertRoleMenu(@Param("roleId") Long roleId, @Param("menuId") Long menuId);

    Role selectByRoleCode(@Param("roleCode") String roleCode);
}
