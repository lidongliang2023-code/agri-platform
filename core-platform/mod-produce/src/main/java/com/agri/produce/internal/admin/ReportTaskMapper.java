package com.agri.produce.internal.admin;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 监管/经营报表生成任务 数据访问。
 */
@Mapper
public interface ReportTaskMapper extends BaseMapper<ReportTaskEntity> {
}
