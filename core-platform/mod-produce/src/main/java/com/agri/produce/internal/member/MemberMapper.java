package com.agri.produce.internal.member;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 生产团队成员（农场主/农技员/巡检员/操作员） 数据访问。
 */
@Mapper
public interface MemberMapper extends BaseMapper<MemberEntity> {
}
