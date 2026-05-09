package com.agri.production.service;

import com.agri.production.entity.ProdPlot;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IProdPlotService extends IService<ProdPlot> {

    IPage<ProdPlot> queryPage(Page<ProdPlot> page, Long farmId, String plotName, String plotType, String status);

    List<ProdPlot> getPlotsByFarmId(Long farmId);

    List<ProdPlot> getPlotsByStatus(String status);

    List<ProdPlot> getPlotsByType(String plotType);

    boolean updatePlotStatus(Long id, String status);
}