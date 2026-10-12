package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminProductService;
import com.agri.admin.vo.ProductStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.entity.Product;
import com.agri.masterdata.mapper.ProductMapper;
import com.agri.masterdata.vo.ProductVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminProductServiceImpl implements IAdminProductService {

    private final ProductMapper productMapper;

    @Override
    public ProductStatisticsVO getProductStatistics(String tenantId, String timeRange) {
        return ProductStatisticsVO.builder()
                .totalProducts(1000L)
                .activeProducts(800L)
                .newProducts(100L)
                .categoryCount(10)
                .build();
    }

    @Override
    public PageResult<ProductVO> getProductList(Integer pageNum, Integer pageSize, String productName, String productCode, String categoryId, String status, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<ProductVO> list = productMapper.selectAdminProductList(offset, pageSize, productName, productCode, categoryId, status, tenantId);
        long total = productMapper.countAdminProductList(productName, productCode, categoryId, status, tenantId);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public ProductVO getProductDetail(Long id) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        return ProductVO.fromEntity(product);
    }

    @Override
    @Transactional
    public void createProduct(ProductSaveDTO dto) {
        Product product = Product.builder()
                .productCode(dto.getProductCode())
                .productName(dto.getProductName())
                .categoryId(dto.getCategoryId())
                .unit(dto.getUnit())
                .price(dto.getPrice())
                .status("ACTIVE")
                .tenantId(dto.getTenantId())
                .build();
        productMapper.insert(product);
    }

    @Override
    @Transactional
    public void updateProduct(Long id, ProductSaveDTO dto) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        product.setProductName(dto.getProductName());
        product.setCategoryId(dto.getCategoryId());
        product.setUnit(dto.getUnit());
        product.setPrice(dto.getPrice());
        productMapper.updateById(product);
    }

    @Override
    @Transactional
    public void deleteProduct(Long id) {
        productMapper.deleteById(id);
    }

    @Override
    @Transactional
    public void updateProductStatus(Long id, String status) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException("商品不存在");
        }
        product.setStatus(status);
        productMapper.updateById(product);
    }

    @Override
    public byte[] exportProducts(String categoryId, String status, String tenantId) {
        return new byte[0];
    }
}