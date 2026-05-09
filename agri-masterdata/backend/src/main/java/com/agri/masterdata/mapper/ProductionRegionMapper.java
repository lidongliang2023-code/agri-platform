package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.ProductionRegion;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ProductionRegionMapper extends BaseMapper<ProductionRegion> {

    List<ProductionRegion> selectByParentCode(@Param("parentCode") String parentCode);

    List<ProductionRegion> selectByRegionType(@Param("regionType") String regionType);

    List<ProductionRegion> selectByProvince(@Param("province") String province);

    ProductionRegion selectByRegionCode(@Param("regionCode") String regionCode);
}