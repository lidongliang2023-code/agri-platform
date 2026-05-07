package com.example.agriplatform.masterdata.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.agriplatform.masterdata.entity.Permission;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface PermissionMapper extends BaseMapper<Permission> {
    List<Permission> selectByRoleId(Long roleId);
}