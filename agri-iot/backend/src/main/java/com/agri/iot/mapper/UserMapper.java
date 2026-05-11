package com.agri.iot.mapper;

import com.agri.iot.entity.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    List<User> selectByTenantId(@Param("tenantId") Long tenantId);

    User selectByUsername(@Param("username") String username);

    List<User> selectByRole(@Param("role") String role);
}