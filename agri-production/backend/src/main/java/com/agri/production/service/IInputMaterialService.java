package com.agri.production.service;

import com.agri.production.dto.InputMaterialPageDTO;
import com.agri.production.dto.InputMaterialSaveDTO;
import com.agri.production.entity.InputMaterial;
import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.InputMaterialVO;
import com.baomidou.mybatisplus.extension.service.IService;

public interface IInputMaterialService extends IService<InputMaterial> {

    InputMaterialVO save(InputMaterialSaveDTO dto, String tenantId);

    InputMaterialVO update(InputMaterialSaveDTO dto, String tenantId);

    void delete(Long id, String tenantId);

    InputMaterialVO getById(Long id, String tenantId);

    PageResult<InputMaterialVO> pageQuery(InputMaterialPageDTO dto, String tenantId);

    InputMaterialVO getByCode(String materialCode, String tenantId);

    InputMaterialVO stockIn(Long id, java.math.BigDecimal quantity, String batchNumber, String tenantId);

    InputMaterialVO stockOut(Long id, java.math.BigDecimal quantity, String usageTaskId, String tenantId);
}