package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.UserIdentity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserIdentityMapper extends BaseMapper<UserIdentity> {

    List<UserIdentity> selectByUserId(String userId);
}