package com.agri.masterdata.mapper;

import com.agri.masterdata.dto.ProductPageDTO;
import com.agri.masterdata.entity.Product;
import com.agri.masterdata.vo.ProductVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    List<ProductVO> selectProductPage(@Param("dto") ProductPageDTO dto);

    long selectProductCount(@Param("dto") ProductPageDTO dto);

    ProductVO selectProductById(@Param("id") Long id);

    Product selectByProductCode(@Param("productCode") String productCode);
}
