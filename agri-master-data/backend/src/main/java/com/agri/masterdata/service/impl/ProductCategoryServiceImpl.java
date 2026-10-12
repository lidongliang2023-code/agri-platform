package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.ProductCategory;
import com.agri.masterdata.mapper.ProductCategoryMapper;
import com.agri.masterdata.service.IProductCategoryService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductCategoryServiceImpl implements IProductCategoryService {

    private final ProductCategoryMapper categoryMapper;

    private static final Map<Long, Map<String, Object>> categoryAttributesCache = new HashMap<>();

    @Override
    public List<ProductCategory> getCategoryTree(Long parentId) {
        List<ProductCategory> allCategories = categoryMapper.selectAll();
        return buildTree(allCategories, parentId);
    }

    @Override
    public ProductCategory getById(Long id) {
        ProductCategory category = categoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException("分类不存在");
        }
        return category;
    }

    @Override
    @Transactional
    public void save(ProductCategory category) {
        if (category.getParentId() != null && category.getParentId() > 0) {
            ProductCategory parent = categoryMapper.selectById(category.getParentId());
            if (parent == null) {
                throw new BusinessException("父分类不存在");
            }
            category.setAncestors(parent.getAncestors() + "," + parent.getId());
        } else {
            category.setParentId(0L);
            category.setAncestors("0");
        }
        categoryMapper.insert(category);
    }

    @Override
    @Transactional
    public void update(Long id, ProductCategory category) {
        ProductCategory existing = categoryMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException("分类不存在");
        }

        if (category.getParentId() != null && !category.getParentId().equals(existing.getParentId())) {
            ProductCategory parent = categoryMapper.selectById(category.getParentId());
            if (parent == null) {
                throw new BusinessException("父分类不存在");
            }
            category.setAncestors(parent.getAncestors() + "," + parent.getId());
        }

        category.setId(id);
        categoryMapper.updateById(category);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        ProductCategory category = categoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException("分类不存在");
        }

        int childrenCount = categoryMapper.countChildren(id);
        if (childrenCount > 0) {
            throw new BusinessException("存在子分类，无法删除");
        }

        categoryMapper.deleteById(id);
    }

    @Override
    public List<ProductCategory> listAll() {
        return categoryMapper.selectAll();
    }

    @Override
    public Map<String, Object> getCategoryAttributes(Long categoryId) {
        return categoryAttributesCache.getOrDefault(categoryId, new HashMap<>());
    }

    @Override
    @Transactional
    public void saveCategoryAttributes(Long categoryId, Map<String, Object> attributes) {
        categoryAttributesCache.put(categoryId, attributes);
    }

    private List<ProductCategory> buildTree(List<ProductCategory> categories, Long parentId) {
        List<ProductCategory> tree = new ArrayList<>();
        Long searchParentId = parentId == null ? 0L : parentId;

        for (ProductCategory category : categories) {
            Long catParentId = category.getParentId() == null ? 0L : category.getParentId();
            if (searchParentId.equals(catParentId)) {
                List<ProductCategory> children = buildTree(categories, category.getId());
                category.setChildren(children);
                tree.add(category);
            }
        }

        tree.sort(Comparator.comparing(ProductCategory::getOrderNum, Comparator.nullsLast(Integer::compareTo)));
        return tree;
    }
}