package com.example.agriplatform.masterdata.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.agriplatform.masterdata.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    User selectByUsername(String username);
}