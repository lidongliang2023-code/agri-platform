package com.agri.production.service;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.dto.FarmSaveDTO;
import com.agri.production.entity.Farm;
import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.FarmVO;
import com.baomidou.mybatisplus.extension.service.IService;

public interface IFarmService extends IService<Farm> {

    FarmVO save(FarmSaveDTO dto, String tenantId);

    FarmVO update(FarmSaveDTO dto, String tenantId);

    void delete(Long id, String tenantId);

    FarmVO getById(Long id, String tenantId);

    PageResult<FarmVO> pageQuery(FarmPageDTO dto, String tenantId);

    FarmVO getByCode(String farmCode, String tenantId);
}