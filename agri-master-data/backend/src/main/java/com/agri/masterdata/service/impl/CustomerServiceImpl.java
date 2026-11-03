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
        // 企业端接口必须带主体上下文：没有就拒绝，绝不退化成"返回所有主体的数据"
        if (tenantId == null || tenantId.isBlank()) {
            throw new com.agri.common.exception.BusinessException(
                    com.agri.common.constant.ErrorCode.PERMISSION_FORBIDDEN,
                    "缺少经营主体上下文：请在请求头携带 X-Agri-Merchant");
        }
        return customerMapper.selectCustomerList(tenantId);
    }

    /**
     * 客户详情。
     *
     * <p><b>必须校验归属</b>：原来这里直接 {@code selectCustomerById(id)} 返回，
     * 换个 id 就能读到别家主体的客户（实测：主体 2001 的账号读到了 T1001 的客户）。
     * 列表接口做了过滤、详情接口没做，是这类越权最常见的形态 —— 页面点不进去，
     * 但直接请求接口可以。</p>
     *
     * <p>归属不符时统一说"不存在或不属于当前主体"，不用两种措辞，
     * 避免被用来探测别家客户是否存在。</p>
     */
    @Override
    public CustomerVO getById(Long id) {
        String tenantId = SecurityUtils.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new com.agri.common.exception.BusinessException(
                    com.agri.common.constant.ErrorCode.PERMISSION_FORBIDDEN,
                    "缺少经营主体上下文：请在请求头携带 X-Agri-Merchant");
        }
        CustomerVO customer = customerMapper.selectCustomerById(id);
        if (customer == null || customer.getTenantId() == null
                || !tenantId.equals(customer.getTenantId())) {
            throw new com.agri.common.exception.BusinessException(
                    com.agri.common.constant.ErrorCode.PERMISSION_FORBIDDEN,
                    "客户不存在或不属于当前主体");
        }
        return customer;
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
