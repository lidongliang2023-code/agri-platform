package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminCustomerService;
import com.agri.admin.vo.CustomerStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.CustomerSaveDTO;
import com.agri.masterdata.dto.SupplierSaveDTO;
import com.agri.masterdata.entity.Customer;
import com.agri.masterdata.entity.Supplier;
import com.agri.masterdata.mapper.CustomerMapper;
import com.agri.masterdata.mapper.SupplierMapper;
import com.agri.masterdata.vo.CustomerVO;
import com.agri.masterdata.vo.SupplierVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminCustomerServiceImpl implements IAdminCustomerService {

    private final CustomerMapper customerMapper;
    private final SupplierMapper supplierMapper;

    @Override
    public CustomerStatisticsVO getCustomerStatistics(String tenantId, String timeRange) {
        return CustomerStatisticsVO.builder()
                .totalCustomers(100L)
                .totalSuppliers(50L)
                .activeCustomers(80L)
                .todayAdded(10L)
                .build();
    }

    @Override
    public PageResult<CustomerVO> getCustomerList(Integer pageNum, Integer pageSize, String customerName, String customerCode, String status, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<CustomerVO> list = customerMapper.selectAdminCustomerList(offset, pageSize, customerName, customerCode, status, tenantId);
        long total = customerMapper.countAdminCustomerList(customerName, customerCode, status, tenantId);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public CustomerVO getCustomerDetail(Long id) {
        Customer customer = customerMapper.selectById(id);
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }
        return CustomerVO.fromEntity(customer);
    }

    @Override
    @Transactional
    public void createCustomer(CustomerSaveDTO dto) {
        Customer customer = Customer.builder()
                .customerCode(dto.getCustomerCode())
                .customerName(dto.getCustomerName())
                .shortName(dto.getShortName())
                .contactName(dto.getContactName())
                .contactPhone(dto.getContactPhone())
                .address(dto.getAddress())
                .status(1)
                .tenantId(dto.getTenantId())
                .build();
        customerMapper.insert(customer);
    }

    @Override
    @Transactional
    public void updateCustomer(Long id, CustomerSaveDTO dto) {
        Customer customer = customerMapper.selectById(id);
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }
        customer.setCustomerName(dto.getCustomerName());
        customer.setShortName(dto.getShortName());
        customer.setContactName(dto.getContactName());
        customer.setContactPhone(dto.getContactPhone());
        customer.setAddress(dto.getAddress());
        customerMapper.updateById(customer);
    }

    @Override
    @Transactional
    public void deleteCustomer(Long id) {
        customerMapper.deleteById(id);
    }

    @Override
    public PageResult<SupplierVO> getSupplierList(Integer pageNum, Integer pageSize, String supplierName, String supplierCode, String status, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<SupplierVO> list = supplierMapper.selectAdminSupplierList(offset, pageSize, supplierName, supplierCode, status, tenantId);
        long total = supplierMapper.countAdminSupplierList(supplierName, supplierCode, status, tenantId);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public SupplierVO getSupplierDetail(Long id) {
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier == null) {
            throw new BusinessException("供应商不存在");
        }
        return SupplierVO.fromEntity(supplier);
    }

    @Override
    @Transactional
    public void createSupplier(SupplierSaveDTO dto) {
        Supplier supplier = Supplier.builder()
                .supplierCode(dto.getSupplierCode())
                .supplierName(dto.getSupplierName())
                .shortName(dto.getShortName())
                .contactPerson(dto.getContactName())
                .contactPhone(dto.getContactPhone())
                .address(dto.getAddress())
                .status(1)
                .tenantId(dto.getTenantId())
                .build();
        supplierMapper.insert(supplier);
    }

    @Override
    @Transactional
    public void updateSupplier(Long id, SupplierSaveDTO dto) {
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier == null) {
            throw new BusinessException("供应商不存在");
        }
        supplier.setSupplierName(dto.getSupplierName());
        supplier.setShortName(dto.getShortName());
        supplier.setContactPerson(dto.getContactName());
        supplier.setContactPhone(dto.getContactPhone());
        supplier.setAddress(dto.getAddress());
        supplierMapper.updateById(supplier);
    }

    @Override
    @Transactional
    public void deleteSupplier(Long id) {
        supplierMapper.deleteById(id);
    }

    @Override
    public List<SupplierVO> getCustomerSupplierRelation(Long customerId) {
        return new ArrayList<>();
    }

    @Override
    public byte[] exportCustomers(String status, String tenantId) {
        return new byte[0];
    }
}