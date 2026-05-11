package com.agri.production.service;

import com.agri.production.dto.PlotPageDTO;
import com.agri.production.dto.PlotSaveDTO;
import com.agri.production.entity.Plot;
import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.PlotVO;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IPlotService extends IService<Plot> {

    PlotVO save(PlotSaveDTO dto, String tenantId);

    PlotVO update(PlotSaveDTO dto, String tenantId);

    void delete(Long id, String tenantId);

    PlotVO getById(Long id, String tenantId);

    PageResult<PlotVO> pageQuery(PlotPageDTO dto, String tenantId);

    List<PlotVO> listByFarmId(Long farmId, String tenantId);

    PlotVO getByCode(String plotCode, String tenantId);
}