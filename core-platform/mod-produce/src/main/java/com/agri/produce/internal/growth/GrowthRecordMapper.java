package com.agri.produce.internal.growth;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 作物生长监测记录（株高/叶片/病虫害/气象） 数据访问。
 */
@Mapper
public interface GrowthRecordMapper extends BaseMapper<GrowthRecordEntity> {
}
