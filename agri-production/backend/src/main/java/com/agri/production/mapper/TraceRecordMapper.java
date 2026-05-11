package com.agri.production.mapper;

import com.agri.production.entity.TraceRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TraceRecordMapper extends BaseMapper<TraceRecord> {

    List<TraceRecord> selectByTraceCode(@Param("traceCode") String traceCode);
}