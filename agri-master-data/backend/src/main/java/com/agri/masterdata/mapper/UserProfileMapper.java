package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.UserProfile;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserProfileMapper extends BaseMapper<UserProfile> {

    List<UserProfile> selectByUserId(String userId);

    UserProfile selectByUserIdAndType(String userId, String profileType);
}