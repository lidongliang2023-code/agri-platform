package com.agri.produce.internal.plan;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 种养计划（作物/品种/周期/预期产量） 数据访问。
 */
@Mapper
public interface PlanInfoMapper extends BaseMapper<PlanInfoEntity> {
}
