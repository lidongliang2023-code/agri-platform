package com.agri.admin.service;

import com.agri.admin.vo.ProductStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.vo.ProductVO;

public interface IAdminProductService {

    ProductStatisticsVO getProductStatistics(String tenantId, String timeRange);

    PageResult<ProductVO> getProductList(Integer pageNum, Integer pageSize, String productName, String productCode, String categoryId, String status, String tenantId);

    ProductVO getProductDetail(Long id);

    void createProduct(ProductSaveDTO dto);

    void updateProduct(Long id, ProductSaveDTO dto);

    void deleteProduct(Long id);

    void updateProductStatus(Long id, String status);

    byte[] exportProducts(String categoryId, String status, String tenantId);
}