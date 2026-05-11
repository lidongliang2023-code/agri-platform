package com.agri.production.mapper;

import com.agri.production.dto.PlotPageDTO;
import com.agri.production.entity.Plot;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface PlotMapper extends BaseMapper<Plot> {

    IPage<Plot> pageQuery(Page<Plot> page, @Param("dto") PlotPageDTO dto, @Param("tenantId") String tenantId);

    List<Plot> selectByFarmId(@Param("farmId") Long farmId, @Param("tenantId") String tenantId);

    Plot selectByCode(@Param("plotCode") String plotCode, @Param("tenantId") String tenantId);
}