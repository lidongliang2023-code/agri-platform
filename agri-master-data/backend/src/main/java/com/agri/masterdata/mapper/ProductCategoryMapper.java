package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.ProductCategory;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface ProductCategoryMapper extends BaseMapper<ProductCategory> {

    List<ProductCategory> selectTree(Long parentId);

    List<ProductCategory> selectAll();

    List<ProductCategory> selectChildren(Long parentId);

    int countChildren(Long parentId);
}