package com.agri.production.mapper;

import com.agri.production.dto.TraceCodeQueryDTO;
import com.agri.production.entity.TraceCode;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TraceCodeMapper extends BaseMapper<TraceCode> {

    IPage<TraceCode> pageQuery(Page<TraceCode> page, @Param("dto") TraceCodeQueryDTO dto, @Param("tenantId") String tenantId);

    TraceCode selectByTraceCode(@Param("traceCode") String traceCode);

    List<TraceCode> selectByHarvestId(@Param("harvestId") Long harvestId, @Param("tenantId") String tenantId);

    int updateQueryCount(@Param("traceCode") String traceCode);
}