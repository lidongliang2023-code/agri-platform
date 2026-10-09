package com.agri.produce.internal.quality;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 检测机构/实验室（资质与认可范围） 数据访问。
 */
@Mapper
public interface QualityLabMapper extends BaseMapper<QualityLabEntity> {
}
