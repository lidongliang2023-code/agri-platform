package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.ProductPageDTO;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.dto.ProductUpdateDTO;
import com.agri.masterdata.entity.Product;
import com.agri.masterdata.mapper.ProductMapper;
import com.agri.masterdata.service.IProductService;
import com.agri.masterdata.vo.ProductVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements IProductService {

    private final ProductMapper productMapper;

    @Override
    public PageResult<ProductVO> page(ProductPageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<ProductVO> list = productMapper.selectProductPage(dto);
        long count = productMapper.selectProductCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public ProductVO getById(Long id) {
        return productMapper.selectProductById(id);
    }

    @Override
    @Transactional
    public void save(ProductSaveDTO dto) {
        Product existing = productMapper.selectByProductCode(dto.getProductCode());
        if (existing != null) {
            throw new BusinessException("商品编码已存在");
        }

        Product product = BeanCopyUtils.copy(dto, Product.class);
        product.setTenantId(SecurityUtils.getTenantId());
        product.setCreateBy(SecurityUtils.getUsername());
        product.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        product.setDelFlag(0);
        productMapper.insert(product);
    }

    @Override
    @Transactional
    public void update(Long id, ProductUpdateDTO dto) {
        Product product = productMapper.selectById(id);
        if (product == null || product.getDelFlag() == 1) {
            throw new BusinessException("商品不存在");
        }

        BeanCopyUtils.copyProperties(dto, product);
        product.setUpdateBy(SecurityUtils.getUsername());
        productMapper.updateById(product);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Product product = productMapper.selectById(id);
        if (product == null || product.getDelFlag() == 1) {
            throw new BusinessException("商品不存在");
        }

        product.setDelFlag(1);
        product.setUpdateBy(SecurityUtils.getUsername());
        productMapper.updateById(product);
    }
}
