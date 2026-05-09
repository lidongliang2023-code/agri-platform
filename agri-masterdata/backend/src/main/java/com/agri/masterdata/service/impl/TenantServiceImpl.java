package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.TenantSaveDTO;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.entity.Tenant;
import com.agri.masterdata.mapper.TenantMapper;
import com.agri.masterdata.service.ITenantService;
import com.agri.masterdata.vo.TenantVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantServiceImpl implements ITenantService {

    private final TenantMapper tenantMapper;

    @Override
    public PageResult<TenantVO> page(Integer pageNum, Integer pageSize, String tenantName, String tenantType) {
        Page<Tenant> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Tenant> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(tenantName != null && !tenantName.isEmpty(), Tenant::getTenantName, tenantName);
        wrapper.eq(tenantType != null && !tenantType.isEmpty(), Tenant::getTenantType, tenantType);
        wrapper.eq(Tenant::getDelFlag, 0);
        IPage<Tenant> result = tenantMapper.selectPage(page, wrapper);
        return new PageResult<>(BeanCopyUtils.copyList(result.getRecords(), TenantVO.class), 
                result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public TenantVO getById(Long id) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null || tenant.getDelFlag() == 1) {
            throw new BusinessException("租户不存在");
        }
        return BeanCopyUtils.copy(tenant, TenantVO.class);
    }

    @Override
    @Transactional
    public void save(TenantSaveDTO dto) {
        Tenant existing = tenantMapper.selectByTenantCode(dto.getTenantCode());
        if (existing != null) {
            throw new BusinessException("租户编码已存在");
        }

        Tenant tenant = BeanCopyUtils.copy(dto, Tenant.class);
        tenant.setTenantId("000000");
        tenant.setCreateBy(SecurityUtils.getUsername());
        tenant.setDelFlag(0);
        tenantMapper.insert(tenant);
    }

    @Override
    @Transactional
    public void update(Long id, TenantUpdateDTO dto) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null || tenant.getDelFlag() == 1) {
            throw new BusinessException("租户不存在");
        }

        BeanCopyUtils.copyProperties(dto, tenant);
        tenant.setUpdateBy(SecurityUtils.getUsername());
        tenantMapper.updateById(tenant);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null || tenant.getDelFlag() == 1) {
            throw new BusinessException("租户不存在");
        }

        tenant.setDelFlag(1);
        tenant.setUpdateBy(SecurityUtils.getUsername());
        tenantMapper.updateById(tenant);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null || tenant.getDelFlag() == 1) {
            throw new BusinessException("租户不存在");
        }

        tenant.setStatus(status);
        tenant.setUpdateBy(SecurityUtils.getUsername());
        tenantMapper.updateById(tenant);
    }

    @Override
    public TenantVO getByTenantCode(String tenantCode) {
        Tenant tenant = tenantMapper.selectByTenantCode(tenantCode);
        if (tenant == null || tenant.getDelFlag() == 1) {
            return null;
        }
        return BeanCopyUtils.copy(tenant, TenantVO.class);
    }
}