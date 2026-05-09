package com.agri.admin.service;

import com.agri.admin.vo.CustomerStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.CustomerSaveDTO;
import com.agri.masterdata.dto.SupplierSaveDTO;
import com.agri.masterdata.vo.CustomerVO;
import com.agri.masterdata.vo.SupplierVO;

import java.util.List;

public interface IAdminCustomerService {

    CustomerStatisticsVO getCustomerStatistics(String tenantId, String timeRange);

    PageResult<CustomerVO> getCustomerList(Integer pageNum, Integer pageSize, String customerName, String customerCode, String status, String tenantId);

    CustomerVO getCustomerDetail(Long id);

    void createCustomer(CustomerSaveDTO dto);

    void updateCustomer(Long id, CustomerSaveDTO dto);

    void deleteCustomer(Long id);

    PageResult<SupplierVO> getSupplierList(Integer pageNum, Integer pageSize, String supplierName, String supplierCode, String status, String tenantId);

    SupplierVO getSupplierDetail(Long id);

    void createSupplier(SupplierSaveDTO dto);

    void updateSupplier(Long id, SupplierSaveDTO dto);

    void deleteSupplier(Long id);

    List<SupplierVO> getCustomerSupplierRelation(Long customerId);

    byte[] exportCustomers(String status, String tenantId);
}