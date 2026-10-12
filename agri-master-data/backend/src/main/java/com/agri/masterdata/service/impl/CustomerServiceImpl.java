package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.CustomerSaveDTO;
import com.agri.masterdata.entity.Customer;
import com.agri.masterdata.mapper.CustomerMapper;
import com.agri.masterdata.service.ICustomerService;
import com.agri.masterdata.vo.CustomerVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomerServiceImpl implements ICustomerService {

    private final CustomerMapper customerMapper;

    @Override
    public List<CustomerVO> list() {
        String tenantId = SecurityUtils.getTenantId();
        return customerMapper.selectCustomerList(tenantId);
    }

    @Override
    public CustomerVO getById(Long id) {
        return customerMapper.selectCustomerById(id);
    }

    @Override
    @Transactional
    public void save(CustomerSaveDTO dto) {
        Customer existing = customerMapper.selectByCustomerCode(dto.getCustomerCode());
        if (existing != null) {
            throw new BusinessException("客户编码已存在");
        }

        Customer customer = BeanCopyUtils.copy(dto, Customer.class);
        customer.setTenantId(SecurityUtils.getTenantId());
        customer.setCreateBy(SecurityUtils.getUsername());
        customer.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        customer.setDelFlag(0);
        customerMapper.insert(customer);
    }

    @Override
    @Transactional
    public void update(Long id, CustomerSaveDTO dto) {
        Customer customer = customerMapper.selectById(id);
        if (customer == null || customer.getDelFlag() == 1) {
            throw new BusinessException("客户不存在");
        }

        BeanCopyUtils.copyProperties(dto, customer);
        customer.setUpdateBy(SecurityUtils.getUsername());
        customerMapper.updateById(customer);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Customer customer = customerMapper.selectById(id);
        if (customer == null || customer.getDelFlag() == 1) {
            throw new BusinessException("客户不存在");
        }

        customer.setDelFlag(1);
        customer.setUpdateBy(SecurityUtils.getUsername());
        customerMapper.updateById(customer);
    }
}
