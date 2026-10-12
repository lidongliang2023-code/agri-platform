package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.ProductAttribute;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ProductAttributeMapper extends BaseMapper<ProductAttribute> {

    List<ProductAttribute> selectByCategoryId(@Param("categoryId") Long categoryId);

    List<ProductAttribute> selectByAttributeCode(@Param("attributeCode") String attributeCode);

    ProductAttribute selectByCategoryIdAndCode(@Param("categoryId") Long categoryId, @Param("attributeCode") String attributeCode);
}