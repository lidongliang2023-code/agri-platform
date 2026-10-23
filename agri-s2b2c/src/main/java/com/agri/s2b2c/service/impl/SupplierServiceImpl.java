package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.mapper.SupplierMapper;
import com.agri.s2b2c.service.SupplierService;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.s2b2c.vo.SupplierVO;
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
public class SupplierServiceImpl extends ServiceImpl<SupplierMapper, Supplier> implements SupplierService {

    private final ProductMapper productMapper;
    private final ObjectMapper objectMapper;

    public SupplierServiceImpl(ProductMapper productMapper, ObjectMapper objectMapper) {
        this.productMapper = productMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public SupplierVO getById(Long id) {
        Supplier supplier = baseMapper.selectById(id);
        return convertToVO(supplier);
    }

    @Override
    public IPage<SupplierVO> pageList(int page, int size, String keyword, String auditStatus) {
        LambdaQueryWrapper<Supplier> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Supplier::getCompanyName, keyword)
                   .or()
                   .like(Supplier::getContactPhone, keyword);
        }
        if (auditStatus != null && !auditStatus.isEmpty()) {
            wrapper.eq(Supplier::getAuditStatus, auditStatus);
        }
        wrapper.orderByDesc(Supplier::getCreateTime);

        Page<Supplier> pageQuery = new Page<>(page, size);
        IPage<Supplier> pageResult = baseMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertToVO);
    }

    @Override
    public boolean apply(Supplier supplier) {
        supplier.setAuditStatus("PENDING");
        supplier.setStatus("ACTIVE");
        supplier.setCreateTime(LocalDateTime.now());
        supplier.setUpdateTime(LocalDateTime.now());
        return save(supplier);
    }

    @Override
    public boolean updateAudit(Long id, String auditStatus, String auditOpinion) {
        Supplier supplier = baseMapper.selectById(id);
        if (supplier == null) return false;
        supplier.setAuditStatus(auditStatus);
        supplier.setAuditOpinion(auditOpinion);
        supplier.setAuditTime(LocalDateTime.now());
        supplier.setUpdateTime(LocalDateTime.now());
        return updateById(supplier);
    }

    @Override
    public boolean updateInfo(Supplier supplier) {
        Supplier existing = baseMapper.selectById(supplier.getId());
        if (existing == null) return false;
        supplier.setAuditStatus(existing.getAuditStatus());
        supplier.setUpdateTime(LocalDateTime.now());
        return updateById(supplier);
    }

    @Override
    public IPage<ProductVO> getProducts(Long supplierId, int page, int size, String status) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getSupplierId, supplierId);
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Product::getStatus, status);
        }
        wrapper.orderByDesc(Product::getCreateTime);

        Page<Product> pageQuery = new Page<>(page, size);
        IPage<Product> pageResult = productMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertProductToVO);
    }

    private SupplierVO convertToVO(Supplier supplier) {
        if (supplier == null) return null;
        SupplierVO vo = new SupplierVO();
        BeanUtils.copyProperties(supplier, vo);
        return vo;
    }

    private ProductVO convertProductToVO(Product product) {
        if (product == null) return null;
        ProductVO vo = new ProductVO();
        BeanUtils.copyProperties(product, vo);
        try {
            vo.setImages(objectMapper.readValue(product.getImages(), new TypeReference<List<String>>() {}));
        } catch (Exception e) {
            vo.setImages(List.of());
        }
        return vo;
    }
}