package com.agri.production.mapper;

import com.agri.production.entity.TraceCode;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TraceCodeMapper extends BaseMapper<TraceCode> {

    @Select("SELECT * FROM agri_prod_trace_code WHERE trace_code = #{traceCode} AND del_flag = 0")
    TraceCode selectByTraceCode(@Param("traceCode") String traceCode);

    @Select("SELECT * FROM agri_prod_trace_code WHERE del_flag = 0 AND batch_id = #{batchId} ORDER BY create_time")
    List<TraceCode> selectByBatchId(@Param("batchId") Long batchId);

    @Select("SELECT * FROM agri_prod_trace_code WHERE del_flag = 0 AND farm_id = #{farmId} ORDER BY create_time DESC")
    List<TraceCode> selectByFarmId(@Param("farmId") Long farmId);

    @Select("SELECT * FROM agri_prod_trace_code WHERE del_flag = 0 AND status = #{status} ORDER BY create_time DESC")
    List<TraceCode> selectByStatus(@Param("status") String status);
}