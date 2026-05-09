package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.ProductRegion;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface ProductRegionMapper extends BaseMapper<ProductRegion> {

    List<ProductRegion> selectByType(String regionType);
}