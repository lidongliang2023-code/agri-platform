package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.UserRole;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserRoleMapper extends BaseMapper<UserRole> {

    List<UserRole> selectByUserId(String userId);

    List<UserRole> selectByRoleId(String roleId);

    void deleteByUserId(String userId);

    void deleteByRoleId(String roleId);
}