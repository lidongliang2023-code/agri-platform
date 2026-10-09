package com.agri.produce.internal.task;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 农事任务执行记录（支持离线回传） 数据访问。
 */
@Mapper
public interface TaskRecordMapper extends BaseMapper<TaskRecordEntity> {
}
