package com.agri.production.service.impl;

import com.agri.production.entity.Tenant;
import com.agri.production.mapper.TenantMapper;
import com.agri.production.service.ITenantService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class TenantServiceImpl implements ITenantService {

    private final TenantMapper tenantMapper;

    public TenantServiceImpl(TenantMapper tenantMapper) {
        this.tenantMapper = tenantMapper;
    }

    @Override
    public Tenant create(Tenant tenant) {
        tenant.setTenantCode("TENANT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        tenant.setStatus("active");
        tenant.setAuditStatus("approved");
        tenant.setMaxFarms(10);
        tenant.setMaxUsers(50);
        tenant.setStorageQuota(10737418240L);
        tenant.setCreateTime(LocalDateTime.now());
        tenant.setUpdateTime(LocalDateTime.now());
        tenant.setDeleted(0);
        tenantMapper.insert(tenant);
        return tenant;
    }

    @Override
    public Tenant update(Long id, Tenant tenant) {
        tenant.setId(id);
        tenant.setUpdateTime(LocalDateTime.now());
        tenantMapper.updateById(tenant);
        return tenantMapper.selectById(id);
    }

    @Override
    public void delete(Long id) {
        LambdaUpdateWrapper<Tenant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Tenant::getId, id).set(Tenant::getDeleted, 1);
        tenantMapper.update(wrapper);
    }

    @Override
    public Tenant getById(Long id) {
        return tenantMapper.selectById(id);
    }

    @Override
    public List<Tenant> listAll() {
        LambdaQueryWrapper<Tenant> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Tenant::getDeleted, 0).orderByDesc(Tenant::getCreateTime);
        return tenantMapper.selectList(wrapper);
    }

    @Override
    public List<Tenant> listByStatus(String status) {
        LambdaQueryWrapper<Tenant> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Tenant::getDeleted, 0).eq(Tenant::getStatus, status);
        return tenantMapper.selectList(wrapper);
    }

    @Override
    public Tenant audit(Long id, String auditStatus, String auditComment) {
        LambdaUpdateWrapper<Tenant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Tenant::getId, id)
               .set(Tenant::getAuditStatus, auditStatus)
               .set(Tenant::getAuditComment, auditComment)
               .set(Tenant::getAuditTime, LocalDateTime.now())
               .set(Tenant::getAuditBy, "admin");
        
        if ("approved".equals(auditStatus)) {
            wrapper.set(Tenant::getStatus, "active");
        } else if ("rejected".equals(auditStatus)) {
            wrapper.set(Tenant::getStatus, "inactive");
        }
        
        tenantMapper.update(wrapper);
        return tenantMapper.selectById(id);
    }

    @Override
    public Tenant updateStatus(Long id, String status) {
        LambdaUpdateWrapper<Tenant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Tenant::getId, id).set(Tenant::getStatus, status);
        tenantMapper.update(wrapper);
        return tenantMapper.selectById(id);
    }

    @Override
    public long countByStatus(String status) {
        LambdaQueryWrapper<Tenant> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Tenant::getDeleted, 0).eq(Tenant::getStatus, status);
        return tenantMapper.selectCount(wrapper);
    }
}
