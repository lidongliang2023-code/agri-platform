package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminProductService;
import com.agri.admin.vo.ProductStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.entity.Product;
import com.agri.masterdata.mapper.ProductMapper;
import com.agri.masterdata.vo.ProductVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
        // 口径：全部来自 agri_md_product 实时计数。
        // 此前这里写死 1000 / 800 / 100 / 10 —— 页面看起来永远"有数"，但一个真数都没有。
        // 没有数据来源的字段（环比、质量分）保持 null，由前端显示为「—」。
        long total = productMapper.selectCount(new LambdaQueryWrapper<Product>()
                .eq(Product::getDelFlag, 0));
        long active = productMapper.selectCount(new LambdaQueryWrapper<Product>()
                .eq(Product::getDelFlag, 0)
                .eq(Product::getStatus, 1));
        long pending = countByAuditStatus("PENDING");
        long approved = countByAuditStatus("APPROVED");
        long rejected = countByAuditStatus("REJECTED");
        return ProductStatisticsVO.builder()
                .totalProducts(total)
                .activeProducts(active)
                .pendingProducts(pending)
                .publishedProducts(approved)
                .offlineProducts(rejected)
                .build();
    }

    private long countByAuditStatus(String auditStatus) {
        return productMapper.selectCount(new LambdaQueryWrapper<Product>()
                .eq(Product::getDelFlag, 0)
                .eq(Product::getAuditStatus, auditStatus));
    }

    @Override
    public PageResult<ProductVO> getProductList(Integer pageNum, Integer pageSize, String productName, String productCode, String categoryId, String status, String auditStatus, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<ProductVO> list = productMapper.selectAdminProductList(offset, pageSize, productName, productCode, categoryId, status, auditStatus, tenantId);
        long total = productMapper.countAdminProductList(productName, productCode, categoryId, status, auditStatus, tenantId);
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
                // 库里 status 是 INT（0/1），不能写 "ACTIVE"（严格模式直接报错）；
                // 新建 SPU 先进审核队列，通过后再由上架动作决定是否对外可见
                .status("0")
                .auditStatus("PENDING")
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
    @Transactional
    public void auditProduct(Long id, String auditStatus) {
        String normalized = auditStatus == null ? "" : auditStatus.trim().toUpperCase();
        if (!List.of("PENDING", "APPROVED", "REJECTED").contains(normalized)) {
            // 明确拒绝非法值：往库里写一个拼错的状态，比 400 难查得多
            throw new BusinessException("审核状态只能是 PENDING / APPROVED / REJECTED");
        }
        Product product = productMapper.selectById(id);
        if (product == null || Integer.valueOf(1).equals(product.getDelFlag())) {
            throw new BusinessException("商品不存在");
        }
        product.setAuditStatus(normalized);
        productMapper.updateById(product);
    }

    @Override
    public byte[] exportProducts(String categoryId, String status, String tenantId) {
        return new byte[0];
    }
}