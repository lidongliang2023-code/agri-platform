package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.SupplierSaveDTO;
import com.agri.masterdata.entity.Supplier;
import com.agri.masterdata.mapper.SupplierMapper;
import com.agri.masterdata.service.ISupplierService;
import com.agri.masterdata.vo.SupplierVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SupplierServiceImpl implements ISupplierService {

    private final SupplierMapper supplierMapper;

    @Override
    public List<SupplierVO> list() {
        String tenantId = SecurityUtils.getTenantId();
        return supplierMapper.selectSupplierList(tenantId);
    }

    @Override
    public SupplierVO getById(Long id) {
        return supplierMapper.selectSupplierById(id);
    }

    @Override
    @Transactional
    public void save(SupplierSaveDTO dto) {
        Supplier existing = supplierMapper.selectBySupplierCode(dto.getSupplierCode());
        if (existing != null) {
            throw new BusinessException("供应商编码已存在");
        }

        Supplier supplier = BeanCopyUtils.copy(dto, Supplier.class);
        supplier.setTenantId(SecurityUtils.getTenantId());
        supplier.setCreateBy(SecurityUtils.getUsername());
        supplier.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        supplier.setDelFlag(0);
        supplierMapper.insert(supplier);
    }

    @Override
    @Transactional
    public void update(Long id, SupplierSaveDTO dto) {
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier == null || supplier.getDelFlag() == 1) {
            throw new BusinessException("供应商不存在");
        }

        BeanCopyUtils.copyProperties(dto, supplier);
        supplier.setUpdateBy(SecurityUtils.getUsername());
        supplierMapper.updateById(supplier);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier == null || supplier.getDelFlag() == 1) {
            throw new BusinessException("供应商不存在");
        }

        supplier.setDelFlag(1);
        supplier.setUpdateBy(SecurityUtils.getUsername());
        supplierMapper.updateById(supplier);
    }
}
