package com.agri.monitor.service.impl;

import com.agri.monitor.dto.PlotPageDTO;
import com.agri.monitor.dto.PlotSaveDTO;
import com.agri.monitor.dto.PlotVO;
import com.agri.monitor.entity.Plot;
import com.agri.monitor.mapper.PlotMapper;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IPlotService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PlotServiceImpl extends ServiceImpl<PlotMapper, Plot> implements IPlotService {

    @Override
    public Result<?> page(PlotPageDTO dto) {
        Page<PlotVO> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        PlotVO queryVO = new PlotVO();
        queryVO.setPlotCode(dto.getPlotCode());
        queryVO.setPlotName(dto.getPlotName());
        queryVO.setCropType(dto.getCropType());
        queryVO.setStatus(dto.getStatus());
        IPage<PlotVO> result = baseMapper.selectPageList(page, queryVO);
        return Result.success(result);
    }

    @Override
    public Result<List<PlotVO>> getAll() {
        LambdaQueryWrapper<Plot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Plot::getDeleted, 0);
        List<Plot> plots = baseMapper.selectList(wrapper);
        List<PlotVO> voList = plots.stream().map(plot -> {
            PlotVO vo = new PlotVO();
            BeanUtils.copyProperties(plot, vo);
            return vo;
        }).collect(Collectors.toList());
        return Result.success(voList);
    }

    @Override
    public Result<PlotVO> detail(Long id) {
        PlotVO vo = baseMapper.selectDetailById(id);
        return Result.success(vo);
    }

    @Override
    public Result<Void> save(PlotSaveDTO dto) {
        Plot plot = new Plot();
        BeanUtils.copyProperties(dto, plot);
        if (plot.getStatus() == null) {
            plot.setStatus(1);
        }
        baseMapper.insert(plot);
        return Result.success();
    }

    @Override
    public Result<Void> update(Long id, PlotSaveDTO dto) {
        Plot plot = baseMapper.selectById(id);
        if (plot == null) {
            return Result.error(404, "地块不存在");
        }
        BeanUtils.copyProperties(dto, plot);
        plot.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(plot);
        return Result.success();
    }

    @Override
    public Result<Void> delete(Long id) {
        baseMapper.deleteById(id);
        return Result.success();
    }
}
