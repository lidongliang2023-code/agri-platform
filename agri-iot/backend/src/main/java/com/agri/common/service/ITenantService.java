package com.agri.common.service;

import com.agri.common.entity.Tenant;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ITenantService extends IService<Tenant> {

    Tenant getByCode(String tenantCode);

    List<Tenant> listByStatus(Integer status);

    boolean saveTenant(Tenant tenant);

    boolean updateTenant(Tenant tenant);

    boolean deleteTenant(Long id);
}