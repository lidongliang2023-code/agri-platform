package com.agri.platform.internal.account;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 用户二次验证 Mapper。 */
@Mapper
public interface UserMfaMapper extends BaseMapper<UserMfaEntity> {
}
