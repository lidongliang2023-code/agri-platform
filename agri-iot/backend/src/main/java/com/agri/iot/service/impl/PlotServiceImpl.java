package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.iot.entity.Plot;
import com.agri.iot.mapper.PlotMapper;
import com.agri.iot.service.IPlotService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlotServiceImpl implements IPlotService {

    private final PlotMapper plotMapper;

    @Override
    public PageResult<Plot> page(String farmId, String cropType, Integer pageNum, Integer pageSize) {
        Page<Plot> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Plot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Plot::getDelFlag, 0);
        if (farmId != null && !farmId.isEmpty()) {
            wrapper.eq(Plot::getId, farmId);
        }
        if (cropType != null && !cropType.isEmpty()) {
            wrapper.eq(Plot::getCropType, cropType);
        }
        IPage<Plot> result = plotMapper.selectPage(page, wrapper);
        return new PageResult<Plot>(result.getRecords(), result.getTotal());
    }

    @Override
    public Plot getById(Long id) {
        Plot plot = plotMapper.selectById(id);
        if (plot == null || plot.getDelFlag() == 1) {
            throw new BusinessException("地块不存在");
        }
        return plot;
    }

    @Override
    public List<Plot> listByFarmId(String farmId) {
        LambdaQueryWrapper<Plot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Plot::getDelFlag, 0);
        return plotMapper.selectList(wrapper);
    }

    @Override
    public List<Plot> listByCropType(String cropType) {
        LambdaQueryWrapper<Plot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Plot::getDelFlag, 0);
        wrapper.eq(Plot::getCropType, cropType);
        return plotMapper.selectList(wrapper);
    }

    @Override
    @Transactional
    public void save(Plot plot) {
        plot.setDeviceCount(0);
        plot.setOnlineDeviceCount(0);
        plot.setStatus(1);
        plot.setDelFlag(0);
        plotMapper.insert(plot);
    }

    @Override
    @Transactional
    public void update(Long id, Plot plot) {
        Plot existing = getById(id);
        plot.setId(id);
        plotMapper.updateById(plot);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Plot plot = getById(id);
        plot.setDelFlag(1);
        plotMapper.updateById(plot);
    }

    @Override
    @Transactional
    public void updateDeviceCount(Long plotId, Integer count) {
        Plot plot = getById(plotId);
        plot.setDeviceCount(count);
        plotMapper.updateById(plot);
    }
}