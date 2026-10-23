package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.Category;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.CategoryMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.mapper.SupplierMapper;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProductServiceImpl extends ServiceImpl<ProductMapper, Product> implements ProductService {

    private final CategoryMapper categoryMapper;
    private final SupplierMapper supplierMapper;
    private final ObjectMapper objectMapper;

    public ProductServiceImpl(CategoryMapper categoryMapper, SupplierMapper supplierMapper, ObjectMapper objectMapper) {
        this.categoryMapper = categoryMapper;
        this.supplierMapper = supplierMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public ProductVO getDetail(Long id) {
        Product product = baseMapper.selectById(id);
        return convertToVO(product);
    }

    @Override
    public IPage<ProductVO> pageList(int page, int size, String keyword, Long categoryId, Long supplierId, String status) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Product::getName, keyword);
        }
        if (categoryId != null) {
            wrapper.eq(Product::getCategoryId, categoryId);
        }
        if (supplierId != null) {
            wrapper.eq(Product::getSupplierId, supplierId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Product::getStatus, status);
        }
        wrapper.orderByDesc(Product::getCreateTime);

        Page<Product> pageQuery = new Page<>(page, size);
        IPage<Product> pageResult = baseMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertToVO);
    }

    @Override
    public boolean create(Product product) {
        product.setStatus("PENDING");
        product.setSales(0);
        product.setCreateTime(LocalDateTime.now());
        product.setUpdateTime(LocalDateTime.now());
        return save(product);
    }

    @Override
    public boolean update(Product product) {
        Product existing = baseMapper.selectById(product.getId());
        if (existing == null) return false;
        product.setStatus(existing.getStatus());
        product.setSales(existing.getSales());
        product.setUpdateTime(LocalDateTime.now());
        return updateById(product);
    }

    @Override
    public boolean updateAudit(Long id, String status, String opinion) {
        Product product = baseMapper.selectById(id);
        if (product == null) return false;
        product.setStatus(status);
        product.setAuditOpinion(opinion);
        product.setAuditTime(LocalDateTime.now());
        product.setUpdateTime(LocalDateTime.now());
        return updateById(product);
    }

    @Override
    public boolean updateStock(Long id, Integer quantity) {
        Product product = baseMapper.selectById(id);
        if (product == null) return false;
        product.setStock(product.getStock() + quantity);
        product.setUpdateTime(LocalDateTime.now());
        return updateById(product);
    }

    private ProductVO convertToVO(Product product) {
        if (product == null) return null;
        ProductVO vo = new ProductVO();
        BeanUtils.copyProperties(product, vo);
        try {
            vo.setImages(objectMapper.readValue(product.getImages(), new TypeReference<List<String>>() {}));
        } catch (Exception e) {
            vo.setImages(List.of());
        }
        Category category = categoryMapper.selectById(product.getCategoryId());
        if (category != null) vo.setCategoryName(category.getName());
        Supplier supplier = supplierMapper.selectById(product.getSupplierId());
        if (supplier != null) vo.setSupplierName(supplier.getShopName());
        return vo;
    }
}