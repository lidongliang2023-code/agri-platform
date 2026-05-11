package com.agri.production.service.impl;

import com.agri.production.dto.PlotPageDTO;
import com.agri.production.dto.PlotSaveDTO;
import com.agri.production.entity.Plot;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.IPlotService;
import com.agri.production.vo.PlotVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PlotServiceImpl extends ServiceImpl<PlotMapper, Plot> implements IPlotService {

    @Override
    @Transactional
    public PlotVO save(PlotSaveDTO dto, String tenantId) {
        Plot plot = BeanCopyUtils.copy(dto, Plot.class);
        plot.setTenantId(tenantId);
        plot.setPlotCode(generatePlotCode(tenantId));
        plot.setStatus("active");
        save(plot);
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    @Override
    @Transactional
    public PlotVO update(PlotSaveDTO dto, String tenantId) {
        Plot plot = getById(dto.getId());
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new RuntimeException("地块不存在");
        }
        BeanCopyUtils.copy(dto, plot);
        updateById(plot);
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Plot plot = getById(id);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new RuntimeException("地块不存在");
        }
        removeById(id);
    }

    @Override
    public PlotVO getById(Long id, String tenantId) {
        Plot plot = getById(id);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new RuntimeException("地块不存在");
        }
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    @Override
    public PageResult<PlotVO> pageQuery(PlotPageDTO dto, String tenantId) {
        Page<Plot> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Plot> result = baseMapper.pageQuery(page, dto, tenantId);
        List<PlotVO> voList = BeanCopyUtils.copyList(result.getRecords(), PlotVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public List<PlotVO> listByFarmId(Long farmId, String tenantId) {
        List<Plot> plots = baseMapper.selectByFarmId(farmId, tenantId);
        return BeanCopyUtils.copyList(plots, PlotVO.class);
    }

    @Override
    public PlotVO getByCode(String plotCode, String tenantId) {
        Plot plot = baseMapper.selectByCode(plotCode, tenantId);
        if (plot == null) {
            throw new RuntimeException("地块不存在");
        }
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    private String generatePlotCode(String tenantId) {
        return "PLT" + System.currentTimeMillis() % 1000000;
    }
}