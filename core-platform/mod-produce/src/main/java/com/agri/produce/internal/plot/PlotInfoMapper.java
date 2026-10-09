package com.agri.produce.internal.plot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 地块/棚（生产底册，溯源链路起点） 数据访问。
 */
@Mapper
public interface PlotInfoMapper extends BaseMapper<PlotInfoEntity> {
}
