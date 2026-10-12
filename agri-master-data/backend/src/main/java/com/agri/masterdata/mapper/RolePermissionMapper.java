package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.RolePermission;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface RolePermissionMapper extends BaseMapper<RolePermission> {

    List<RolePermission> selectByRoleId(String roleId);

    void deleteByRoleId(String roleId);
}