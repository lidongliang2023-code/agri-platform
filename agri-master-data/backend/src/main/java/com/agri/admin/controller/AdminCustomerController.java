package com.agri.admin.controller;

import com.agri.admin.service.IAdminCustomerService;
import com.agri.admin.vo.CustomerStatisticsVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.CustomerSaveDTO;
import com.agri.masterdata.dto.SupplierSaveDTO;
import com.agri.masterdata.vo.CustomerVO;
import com.agri.masterdata.vo.SupplierVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "客户供应商管理")
@RestController
@RequestMapping("/admin/masterdata/customer")
@RequiredArgsConstructor
public class AdminCustomerController {

    private final IAdminCustomerService adminCustomerService;

    @Operation(summary = "获取客户统计概览")
    @GetMapping("/statistics")
    public ApiResponse<CustomerStatisticsVO> getCustomerStatistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String timeRange) {
        return ApiResponse.success(adminCustomerService.getCustomerStatistics(tenantId, timeRange));
    }

    @Operation(summary = "获取客户列表")
    @GetMapping("/list")
    public ApiResponse<PageResult<CustomerVO>> getCustomerList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String customerName,
            @RequestParam(required = false) String customerCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminCustomerService.getCustomerList(pageNum, pageSize, customerName, customerCode, status, tenantId));
    }

    @Operation(summary = "获取客户详情")
    @GetMapping("/detail/{id}")
    public ApiResponse<CustomerVO> getCustomerDetail(@PathVariable Long id) {
        return ApiResponse.success(adminCustomerService.getCustomerDetail(id));
    }

    @Operation(summary = "创建客户")
    @PostMapping
    public ApiResponse<Void> createCustomer(@RequestBody CustomerSaveDTO dto) {
        adminCustomerService.createCustomer(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑客户")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateCustomer(@PathVariable Long id, @RequestBody CustomerSaveDTO dto) {
        adminCustomerService.updateCustomer(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除客户")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCustomer(@PathVariable Long id) {
        adminCustomerService.deleteCustomer(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取供应商列表")
    @GetMapping("/supplier/list")
    public ApiResponse<PageResult<SupplierVO>> getSupplierList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String supplierName,
            @RequestParam(required = false) String supplierCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminCustomerService.getSupplierList(pageNum, pageSize, supplierName, supplierCode, status, tenantId));
    }

    @Operation(summary = "获取供应商详情")
    @GetMapping("/supplier/detail/{id}")
    public ApiResponse<SupplierVO> getSupplierDetail(@PathVariable Long id) {
        return ApiResponse.success(adminCustomerService.getSupplierDetail(id));
    }

    @Operation(summary = "创建供应商")
    @PostMapping("/supplier")
    public ApiResponse<Void> createSupplier(@RequestBody SupplierSaveDTO dto) {
        adminCustomerService.createSupplier(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑供应商")
    @PutMapping("/supplier/{id}")
    public ApiResponse<Void> updateSupplier(@PathVariable Long id, @RequestBody SupplierSaveDTO dto) {
        adminCustomerService.updateSupplier(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除供应商")
    @DeleteMapping("/supplier/{id}")
    public ApiResponse<Void> deleteSupplier(@PathVariable Long id) {
        adminCustomerService.deleteSupplier(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取客户供应商关系")
    @GetMapping("/relation/{customerId}")
    public ApiResponse<List<SupplierVO>> getCustomerSupplierRelation(@PathVariable Long customerId) {
        return ApiResponse.success(adminCustomerService.getCustomerSupplierRelation(customerId));
    }

    @Operation(summary = "导出客户数据")
    @GetMapping("/export")
    public ApiResponse<byte[]> exportCustomers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminCustomerService.exportCustomers(status, tenantId));
    }
}