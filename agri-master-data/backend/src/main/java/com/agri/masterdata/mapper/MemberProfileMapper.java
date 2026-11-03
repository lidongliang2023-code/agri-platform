package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.MemberProfile;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 成员任职档案 Mapper。
 *
 * <p>只有基础 CRUD —— 本表不涉及跨表复杂查询，部门/岗位名称在控制器里按 id 回查，
 * 避免再写一份 XML 映射（同名列 {@code dept_id} 在部门表与岗位表语义不同，
 * 写 join 容易踩坑）。</p>
 */
@Mapper
public interface MemberProfileMapper extends BaseMapper<MemberProfile> {
}
