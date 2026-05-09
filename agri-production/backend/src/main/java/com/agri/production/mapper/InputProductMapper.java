package com.agri.production.mapper;

import com.agri.production.entity.InputProduct;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface InputProductMapper extends BaseMapper<InputProduct> {

    @Select("SELECT * FROM agri_prod_input_product WHERE del_flag = 0 AND status = 'active' ORDER BY product_name")
    List<InputProduct> selectActiveProducts();

    @Select("SELECT * FROM agri_prod_input_product WHERE del_flag = 0 AND category = #{category} ORDER BY product_name")
    List<InputProduct> selectByCategory(@Param("category") String category);

    @Select("SELECT * FROM agri_prod_input_product WHERE del_flag = 0 AND forbidden = 0 ORDER BY product_name")
    List<InputProduct> selectAvailableProducts();

    @Select("SELECT * FROM agri_prod_input_product WHERE del_flag = 0 AND tenant_id = #{tenantId} ORDER BY create_time DESC")
    List<InputProduct> selectByTenantId(@Param("tenantId") String tenantId);
}