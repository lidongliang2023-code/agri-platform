package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Menu;
import com.agri.masterdata.vo.MenuVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MenuMapper extends BaseMapper<Menu> {

    List<MenuVO> selectMenuTree(@Param("tenantId") String tenantId);

    List<String> selectUserPermissions(@Param("userId") Long userId);

    List<MenuVO> selectMenusByRoleId(@Param("roleId") Long roleId);
}
