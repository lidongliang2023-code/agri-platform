package com.agri.produce.internal.plan;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 种养计划阶段（整地/播种/施肥…） 数据访问。
 */
@Mapper
public interface PlanStageMapper extends BaseMapper<PlanStageEntity> {
}
