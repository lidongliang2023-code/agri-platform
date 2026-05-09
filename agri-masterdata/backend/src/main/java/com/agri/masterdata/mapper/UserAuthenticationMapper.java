package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.UserAuthentication;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserAuthenticationMapper extends BaseMapper<UserAuthentication> {

    List<UserAuthentication> selectByUserId(String userId);

    List<UserAuthentication> selectByStatus(String authStatus);

    UserAuthentication selectByUserIdAndType(String userId, String authType);
}