package com.agri.production.service;

import com.agri.production.entity.Facility;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IFacilityService extends IService<Facility> {

    IPage<Facility> queryPage(Page<Facility> page, Long farmId, String facilityName, String facilityType, String status);

    List<Facility> getFacilitiesByFarmId(Long farmId);

    List<Facility> getFacilitiesByType(String facilityType);

    List<Facility> getFacilitiesByStatus(String status);

    boolean updateFacilityStatus(Long id, String status);
}