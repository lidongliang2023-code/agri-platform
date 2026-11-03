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
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
        // 全部按 agri_md_customer / agri_md_supplier 实时计数。
        // 此前这里写死 100 / 50 / 80 / 10，页面上的"客户数"与库里实际行数无关。
        long totalCustomers = customerMapper.selectCount(new LambdaQueryWrapper<Customer>()
                .eq(Customer::getDelFlag, 0));
        long activeCustomers = customerMapper.selectCount(new LambdaQueryWrapper<Customer>()
                .eq(Customer::getDelFlag, 0)
                .eq(Customer::getStatus, 1));
        long inactiveCustomers = Math.max(0, totalCustomers - activeCustomers);

        long totalSuppliers = supplierMapper.selectCount(new LambdaQueryWrapper<Supplier>()
                .eq(Supplier::getDelFlag, 0));
        long activeSuppliers = supplierMapper.selectCount(new LambdaQueryWrapper<Supplier>()
                .eq(Supplier::getDelFlag, 0)
                .eq(Supplier::getStatus, 1));

        return CustomerStatisticsVO.builder()
                .totalCustomers(totalCustomers)
                .activeCustomers(activeCustomers)
                .inactiveCustomers(inactiveCustomers)
                // todayAdded 需要 create_time 的按日聚合，实体未映射该列 —— 保持 null 由前端显示「—」
                .totalSuppliers(totalSuppliers)
                .activeSuppliers(activeSuppliers)
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
                .creditCode(dto.getCreditCode())
                .legalPerson(dto.getLegalPerson())
                .level(dto.getLevel())
                // 原来写死 1：新建页选了「禁用」也会变成正常
                .status(dto.getStatus() == null ? 1 : dto.getStatus())
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
        if (dto.getCustomerName() != null) customer.setCustomerName(dto.getCustomerName());
        if (dto.getShortName() != null) customer.setShortName(dto.getShortName());
        if (dto.getContactName() != null) customer.setContactName(dto.getContactName());
        if (dto.getContactPhone() != null) customer.setContactPhone(dto.getContactPhone());
        if (dto.getAddress() != null) customer.setAddress(dto.getAddress());
        if (dto.getCreditCode() != null) customer.setCreditCode(dto.getCreditCode());
        if (dto.getLegalPerson() != null) customer.setLegalPerson(dto.getLegalPerson());
        if (dto.getLevel() != null) customer.setLevel(dto.getLevel());
        // 原来不落 status：列表页的「启用/禁用」按下去返回 200 但状态不变（静默成功）
        if (dto.getStatus() != null) customer.setStatus(dto.getStatus());
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
                // DTO 用 contactName 提交，库里存 contact_person；两个都接受，避免调用方猜字段
                .contactPerson(firstNonBlank(dto.getContactName(), dto.getContactPerson()))
                .contactPhone(dto.getContactPhone())
                .address(dto.getAddress())
                .creditCode(dto.getCreditCode())
                .legalPerson(dto.getLegalPerson())
                .level(dto.getLevel())
                .status(dto.getStatus() == null ? 1 : dto.getStatus())
                .tenantId(dto.getTenantId())
                .build();
        supplierMapper.insert(supplier);
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first;
        if (second != null && !second.isBlank()) return second;
        return first;
    }

    @Override
    @Transactional
    public void updateSupplier(Long id, SupplierSaveDTO dto) {
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier == null) {
            throw new BusinessException("供应商不存在");
        }
        if (dto.getSupplierName() != null) supplier.setSupplierName(dto.getSupplierName());
        if (dto.getShortName() != null) supplier.setShortName(dto.getShortName());
        String contact = firstNonBlank(dto.getContactName(), dto.getContactPerson());
        if (contact != null) supplier.setContactPerson(contact);
        if (dto.getContactPhone() != null) supplier.setContactPhone(dto.getContactPhone());
        if (dto.getAddress() != null) supplier.setAddress(dto.getAddress());
        if (dto.getCreditCode() != null) supplier.setCreditCode(dto.getCreditCode());
        if (dto.getLegalPerson() != null) supplier.setLegalPerson(dto.getLegalPerson());
        if (dto.getLevel() != null) supplier.setLevel(dto.getLevel());
        // 同上：原来不落 status，「启用/禁用」是空操作
        if (dto.getStatus() != null) supplier.setStatus(dto.getStatus());
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