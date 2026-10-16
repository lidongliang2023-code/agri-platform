package com.agri.production.mapper;

import com.agri.production.entity.GrowthRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 生长监测记录 mapper。
 *
 * <p>本段全部是单表条件查询与聚合，用 MyBatis-Plus 的条件构造器表达即可，
 * 不另写 XML —— 少一处"实体列与 SQL 列对不上"的踩雷面。</p>
 */
@Mapper
public interface GrowthRecordMapper extends BaseMapper<GrowthRecord> {
}
