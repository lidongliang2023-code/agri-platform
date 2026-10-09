package com.agri.produce.internal.input;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 投入品使用记录（农事任务落地，溯源关键证据） 数据访问。
 */
@Mapper
public interface InputUsageMapper extends BaseMapper<InputUsageEntity> {
}
