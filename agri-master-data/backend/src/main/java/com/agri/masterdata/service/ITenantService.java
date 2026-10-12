package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.TenantSaveDTO;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.entity.Tenant;
import com.agri.masterdata.vo.TenantVO;

public interface ITenantService {

    PageResult<TenantVO> page(Integer pageNum, Integer pageSize, String tenantName, String tenantType);

    TenantVO getById(Long id);

    void save(TenantSaveDTO dto);

    void update(Long id, TenantUpdateDTO dto);

    void delete(Long id);

    void changeStatus(Long id, Integer status);

    TenantVO getByTenantCode(String tenantCode);

    TenantVO convertToVO(Tenant tenant);
}