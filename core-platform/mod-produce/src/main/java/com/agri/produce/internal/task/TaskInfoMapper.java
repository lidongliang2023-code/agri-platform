package com.agri.produce.internal.task;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 农事任务（派发/执行/验收闭环） 数据访问。
 */
@Mapper
public interface TaskInfoMapper extends BaseMapper<TaskInfoEntity> {
}
