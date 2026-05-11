package com.agri.production.service;

import com.agri.production.dto.HarvestPageDTO;
import com.agri.production.dto.HarvestSaveDTO;
import com.agri.production.entity.Harvest;
import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.HarvestVO;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IHarvestService extends IService<Harvest> {

    HarvestVO save(HarvestSaveDTO dto, String tenantId);

    HarvestVO update(HarvestSaveDTO dto, String tenantId);

    void delete(Long id, String tenantId);

    HarvestVO getById(Long id, String tenantId);

    PageResult<HarvestVO> pageQuery(HarvestPageDTO dto, String tenantId);

    List<HarvestVO> listByFarmId(Long farmId, String tenantId);

    HarvestVO getByCode(String harvestCode, String tenantId);

    HarvestVO complete(Long id, java.math.BigDecimal actualQuantity, String qualityGrade, String tenantId);
}