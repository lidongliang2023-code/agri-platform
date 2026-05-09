package com.agri.common.service.impl;

import com.agri.common.entity.Tenant;
import com.agri.common.mapper.TenantMapper;
import com.agri.common.service.ITenantService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TenantServiceImpl extends ServiceImpl<TenantMapper, Tenant> implements ITenantService {

    @Override
    public Tenant getByCode(String tenantCode) {
        return baseMapper.selectOne(new LambdaQueryWrapper<Tenant>().eq(Tenant::getTenantCode, tenantCode));
    }

    @Override
    public List<Tenant> listByStatus(Integer status) {
        return baseMapper.selectList(new LambdaQueryWrapper<Tenant>().eq(Tenant::getStatus, status));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean saveTenant(Tenant tenant) {
        tenant.setStatus(1);
        return save(tenant);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateTenant(Tenant tenant) {
        return updateById(tenant);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteTenant(Long id) {
        return removeById(id);
    }
}