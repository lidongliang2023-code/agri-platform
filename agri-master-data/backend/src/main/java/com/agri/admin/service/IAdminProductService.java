package com.agri.admin.service;

import com.agri.admin.vo.ProductStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.vo.ProductVO;

public interface IAdminProductService {

    ProductStatisticsVO getProductStatistics(String tenantId, String timeRange);

    PageResult<ProductVO> getProductList(Integer pageNum, Integer pageSize, String productName, String productCode, String categoryId, String status, String auditStatus, String tenantId);

    ProductVO getProductDetail(Long id);

    void createProduct(ProductSaveDTO dto);

    void updateProduct(Long id, ProductSaveDTO dto);

    void deleteProduct(Long id);

    void updateProductStatus(Long id, String status);

    /**
     * SPU 准入审核：只改 audit_status（PENDING / APPROVED / REJECTED），不动上下架 status。
     * 审核通过 ≠ 自动上架 —— 上架是发布动作，由 updateProductStatus 单独负责。
     */
    void auditProduct(Long id, String auditStatus);

    byte[] exportProducts(String categoryId, String status, String tenantId);
}