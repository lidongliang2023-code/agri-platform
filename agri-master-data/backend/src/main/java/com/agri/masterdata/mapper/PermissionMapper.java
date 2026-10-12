package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Permission;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface PermissionMapper extends BaseMapper<Permission> {

    List<Permission> selectByParentId(String parentId);

    List<Permission> selectByRoleId(String roleId);

    List<Permission> selectAllPermissions();
}