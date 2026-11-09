package com.agri.production.mapper;

import com.agri.production.entity.ReportTask;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ReportTaskMapper extends BaseMapper<ReportTask> {
    @org.apache.ibatis.annotations.Select("SELECT * FROM agri_prod_report_task WHERE report_code = #{code} AND deleted = 0 FOR UPDATE")
    ReportTask lockByCode(@org.apache.ibatis.annotations.Param("code") String code);
}
