package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.DataPermission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DataPermissionMapper {

    void insert(DataPermission dataPermission);

    void update(DataPermission dataPermission);

    void deleteById(@Param("dpId") String dpId);

    void deleteByRoleId(@Param("roleId") String roleId);

    DataPermission selectById(@Param("dpId") String dpId);

    List<DataPermission> selectByRoleId(@Param("roleId") String roleId);

    List<DataPermission> selectByModuleType(@Param("moduleType") String moduleType);
}