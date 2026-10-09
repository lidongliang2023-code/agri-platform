package com.agri.produce.internal.quality;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 质量检测（自检/送检/抽检） 数据访问。
 */
@Mapper
public interface InspectionMapper extends BaseMapper<InspectionEntity> {
}
