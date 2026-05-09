package com.agri.production.mapper;

import com.agri.production.entity.Inventory;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface InventoryMapper extends BaseMapper<Inventory> {

    @Select("SELECT * FROM agri_prod_inventory WHERE del_flag = 0 AND farm_id = #{farmId} ORDER BY product_name")
    List<Inventory> selectByFarmId(@Param("farmId") Long farmId);

    @Select("SELECT * FROM agri_prod_inventory WHERE del_flag = 0 AND product_type = #{productType} ORDER BY product_name")
    List<Inventory> selectByProductType(@Param("productType") String productType);

    @Select("SELECT * FROM agri_prod_inventory WHERE del_flag = 0 AND warehouse_type = #{warehouseType} ORDER BY product_name")
    List<Inventory> selectByWarehouseType(@Param("warehouseType") String warehouseType);

    @Select("SELECT * FROM agri_prod_inventory WHERE del_flag = 0 AND alert_status != 'normal' ORDER BY expire_date")
    List<Inventory> selectAlertInventories();
}