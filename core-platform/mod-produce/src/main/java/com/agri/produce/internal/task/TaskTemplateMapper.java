package com.agri.produce.internal.task;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 农事任务模板（按作物/阶段预置） 数据访问。
 */
@Mapper
public interface TaskTemplateMapper extends BaseMapper<TaskTemplateEntity> {
}
