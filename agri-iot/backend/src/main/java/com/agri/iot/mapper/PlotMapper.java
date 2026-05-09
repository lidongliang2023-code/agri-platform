package com.agri.iot.mapper;

import com.agri.iot.dto.request.PlotQueryDTO;
import com.agri.iot.entity.Plot;
import com.agri.iot.vo.PlotVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface PlotMapper extends BaseMapper<Plot> {

    List<PlotVO> selectPageVO(@Param("dto") PlotQueryDTO dto);

    long selectCount(@Param("dto") PlotQueryDTO dto);

    PlotVO selectVOById(Long id);

    Plot selectByPlotCode(String plotCode);

    List<PlotVO> selectAllVO();
}