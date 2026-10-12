package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.ProductAttributeSaveDTO;
import com.agri.masterdata.dto.ProductAttributeUpdateDTO;
import com.agri.masterdata.entity.ProductAttribute;
import com.agri.masterdata.mapper.ProductAttributeMapper;
import com.agri.masterdata.service.IProductAttributeService;
import com.agri.masterdata.vo.ProductAttributeVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductAttributeServiceImpl implements IProductAttributeService {

    private final ProductAttributeMapper productAttributeMapper;

    @Override
    public List<ProductAttributeVO> list(Long categoryId) {
        List<ProductAttribute> list;
        if (categoryId != null) {
            list = productAttributeMapper.selectByCategoryId(categoryId);
        } else {
            list = productAttributeMapper.selectList(null);
        }
        return BeanCopyUtils.copyList(list, ProductAttributeVO.class);
    }

    @Override
    public ProductAttributeVO getById(Long id) {
        ProductAttribute attribute = productAttributeMapper.selectById(id);
        if (attribute == null || attribute.getDelFlag() == 1) {
            throw new BusinessException("属性不存在");
        }
        return BeanCopyUtils.copy(attribute, ProductAttributeVO.class);
    }

    @Override
    @Transactional
    public void save(ProductAttributeSaveDTO dto) {
        ProductAttribute existing = productAttributeMapper.selectByCategoryIdAndCode(dto.getCategoryId(), dto.getAttributeCode());
        if (existing != null) {
            throw new BusinessException("该分类下属性编码已存在");
        }

        ProductAttribute attribute = BeanCopyUtils.copy(dto, ProductAttribute.class);
        attribute.setTenantId(SecurityUtils.getTenantId());
        attribute.setCreateBy(SecurityUtils.getUsername());
        attribute.setDelFlag(0);
        productAttributeMapper.insert(attribute);
    }

    @Override
    @Transactional
    public void update(Long id, ProductAttributeUpdateDTO dto) {
        ProductAttribute attribute = productAttributeMapper.selectById(id);
        if (attribute == null || attribute.getDelFlag() == 1) {
            throw new BusinessException("属性不存在");
        }

        BeanCopyUtils.copyProperties(dto, attribute);
        attribute.setUpdateBy(SecurityUtils.getUsername());
        productAttributeMapper.updateById(attribute);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        ProductAttribute attribute = productAttributeMapper.selectById(id);
        if (attribute == null || attribute.getDelFlag() == 1) {
            throw new BusinessException("属性不存在");
        }

        attribute.setDelFlag(1);
        attribute.setUpdateBy(SecurityUtils.getUsername());
        productAttributeMapper.updateById(attribute);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        ProductAttribute attribute = productAttributeMapper.selectById(id);
        if (attribute == null || attribute.getDelFlag() == 1) {
            throw new BusinessException("属性不存在");
        }

        attribute.setStatus(status);
        attribute.setUpdateBy(SecurityUtils.getUsername());
        productAttributeMapper.updateById(attribute);
    }
}