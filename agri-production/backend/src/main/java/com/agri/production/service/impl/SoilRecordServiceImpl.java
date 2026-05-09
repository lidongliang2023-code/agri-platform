package com.agri.production.service.impl;

import com.agri.production.entity.SoilRecord;
import com.agri.production.mapper.SoilRecordMapper;
import com.agri.production.service.ISoilRecordService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
@Slf4j
public class SoilRecordServiceImpl extends ServiceImpl<SoilRecordMapper, SoilRecord> implements ISoilRecordService {

    @Override
    public IPage<SoilRecord> queryPage(Page<SoilRecord> page, Long plotId, String healthLevel) {
        LambdaQueryWrapper<SoilRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SoilRecord::getDelFlag, 0);
        
        if (plotId != null) {
            wrapper.eq(SoilRecord::getPlotId, plotId);
        }
        if (healthLevel != null && !healthLevel.isEmpty()) {
            wrapper.eq(SoilRecord::getHealthLevel, healthLevel);
        }
        
        wrapper.orderByDesc(SoilRecord::getSampleDate);
        return this.page(page, wrapper);
    }

    @Override
    public List<SoilRecord> getRecordsByPlotId(Long plotId) {
        LambdaQueryWrapper<SoilRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SoilRecord::getDelFlag, 0)
               .eq(SoilRecord::getPlotId, plotId)
               .orderByDesc(SoilRecord::getSampleDate);
        return this.list(wrapper);
    }

    @Override
    public List<SoilRecord> getRecordsByHealthLevel(String healthLevel) {
        LambdaQueryWrapper<SoilRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SoilRecord::getDelFlag, 0)
               .eq(SoilRecord::getHealthLevel, healthLevel)
               .orderByDesc(SoilRecord::getSampleDate);
        return this.list(wrapper);
    }

    @Override
    public SoilRecord getLatestRecord(Long plotId) {
        LambdaQueryWrapper<SoilRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SoilRecord::getDelFlag, 0)
               .eq(SoilRecord::getPlotId, plotId)
               .orderByDesc(SoilRecord::getSampleDate)
               .last("LIMIT 1");
        return this.getOne(wrapper);
    }
}