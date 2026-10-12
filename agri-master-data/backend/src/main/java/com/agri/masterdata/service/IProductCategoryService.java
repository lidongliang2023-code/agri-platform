package com.agri.masterdata.service;

import com.agri.masterdata.entity.ProductCategory;

import java.util.List;
import java.util.Map;

public interface IProductCategoryService {

    List<ProductCategory> getCategoryTree(Long parentId);

    ProductCategory getById(Long id);

    void save(ProductCategory category);

    void update(Long id, ProductCategory category);

    void delete(Long id);

    List<ProductCategory> listAll();

    Map<String, Object> getCategoryAttributes(Long categoryId);

    void saveCategoryAttributes(Long categoryId, Map<String, Object> attributes);
}