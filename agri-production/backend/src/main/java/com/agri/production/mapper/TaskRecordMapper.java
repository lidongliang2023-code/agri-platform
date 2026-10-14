package com.agri.production.mapper;

import com.agri.production.entity.TaskRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 任务执行记录（打卡）。分页走 MyBatis-Plus 自带能力，无需 XML。 */
@Mapper
public interface TaskRecordMapper extends BaseMapper<TaskRecord> {
}
