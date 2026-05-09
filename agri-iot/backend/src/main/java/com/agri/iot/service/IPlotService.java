package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.entity.Plot;

import java.util.List;

public interface IPlotService {

    PageResult<Plot> page(String farmId, String cropType, Integer pageNum, Integer pageSize);

    Plot getById(Long id);

    List<Plot> listByFarmId(String farmId);

    List<Plot> listByCropType(String cropType);

    void save(Plot plot);

    void update(Long id, Plot plot);

    void delete(Long id);

    void updateDeviceCount(Long plotId, Integer count);
}