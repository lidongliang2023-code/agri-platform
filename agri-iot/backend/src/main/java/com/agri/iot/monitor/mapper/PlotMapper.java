package com.agri.monitor.mapper;

import com.agri.monitor.entity.Plot;
import com.agri.monitor.dto.PlotVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface PlotMapper extends BaseMapper<Plot> {
    IPage<PlotVO> selectPageList(Page<?> page, @Param("dto") PlotVO dto);
    PlotVO selectDetailById(@Param("id") Long id);
}
