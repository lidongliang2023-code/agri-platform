package com.agri.production.service.impl;

import com.agri.production.entity.ProdPlot;
import com.agri.production.mapper.ProdPlotMapper;
import com.agri.production.service.IProdPlotService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
@Slf4j
public class ProdPlotServiceImpl extends ServiceImpl<ProdPlotMapper, ProdPlot> implements IProdPlotService {

    @Override
    public IPage<ProdPlot> queryPage(Page<ProdPlot> page, Long farmId, String plotName, String plotType, String status) {
        LambdaQueryWrapper<ProdPlot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProdPlot::getDelFlag, 0);
        
        if (farmId != null) {
            wrapper.eq(ProdPlot::getFarmId, farmId);
        }
        if (plotName != null && !plotName.isEmpty()) {
            wrapper.like(ProdPlot::getPlotName, plotName);
        }
        if (plotType != null && !plotType.isEmpty()) {
            wrapper.eq(ProdPlot::getPlotType, plotType);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(ProdPlot::getStatus, status);
        }
        
        wrapper.orderByDesc(ProdPlot::getCreateTime);
        return this.page(page, wrapper);
    }

    @Override
    public List<ProdPlot> getPlotsByFarmId(Long farmId) {
        LambdaQueryWrapper<ProdPlot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProdPlot::getDelFlag, 0)
               .eq(ProdPlot::getFarmId, farmId)
               .orderByDesc(ProdPlot::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<ProdPlot> getPlotsByStatus(String status) {
        LambdaQueryWrapper<ProdPlot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProdPlot::getDelFlag, 0)
               .eq(ProdPlot::getStatus, status)
               .orderByDesc(ProdPlot::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<ProdPlot> getPlotsByType(String plotType) {
        LambdaQueryWrapper<ProdPlot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProdPlot::getDelFlag, 0)
               .eq(ProdPlot::getPlotType, plotType)
               .orderByDesc(ProdPlot::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updatePlotStatus(Long id, String status) {
        ProdPlot plot = this.getById(id);
        if (plot == null || plot.getDelFlag() == 1) {
            return false;
        }
        plot.setStatus(status);
        plot.setUpdateTime(new Date());
        return this.updateById(plot);
    }
}