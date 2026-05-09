package com.agri.production.service.impl;

import com.agri.production.entity.Facility;
import com.agri.production.mapper.FacilityMapper;
import com.agri.production.service.IFacilityService;
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
public class FacilityServiceImpl extends ServiceImpl<FacilityMapper, Facility> implements IFacilityService {

    @Override
    public IPage<Facility> queryPage(Page<Facility> page, Long farmId, String facilityName, String facilityType, String status) {
        LambdaQueryWrapper<Facility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Facility::getDelFlag, 0);
        
        if (farmId != null) {
            wrapper.eq(Facility::getFarmId, farmId);
        }
        if (facilityName != null && !facilityName.isEmpty()) {
            wrapper.like(Facility::getFacilityName, facilityName);
        }
        if (facilityType != null && !facilityType.isEmpty()) {
            wrapper.eq(Facility::getFacilityType, facilityType);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Facility::getStatus, status);
        }
        
        wrapper.orderByDesc(Facility::getCreateTime);
        return this.page(page, wrapper);
    }

    @Override
    public List<Facility> getFacilitiesByFarmId(Long farmId) {
        LambdaQueryWrapper<Facility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Facility::getDelFlag, 0)
               .eq(Facility::getFarmId, farmId)
               .orderByDesc(Facility::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<Facility> getFacilitiesByType(String facilityType) {
        LambdaQueryWrapper<Facility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Facility::getDelFlag, 0)
               .eq(Facility::getFacilityType, facilityType)
               .orderByDesc(Facility::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<Facility> getFacilitiesByStatus(String status) {
        LambdaQueryWrapper<Facility> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Facility::getDelFlag, 0)
               .eq(Facility::getStatus, status)
               .orderByDesc(Facility::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateFacilityStatus(Long id, String status) {
        Facility facility = this.getById(id);
        if (facility == null || facility.getDelFlag() == 1) {
            return false;
        }
        facility.setStatus(status);
        facility.setUpdateTime(new Date());
        return this.updateById(facility);
    }
}