package com.agri.produce.internal.harvest;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 采收作业记录（每次下地采收的原始登记） 数据访问。
 */
@Mapper
public interface HarvestRecordMapper extends BaseMapper<HarvestRecordEntity> {
}
