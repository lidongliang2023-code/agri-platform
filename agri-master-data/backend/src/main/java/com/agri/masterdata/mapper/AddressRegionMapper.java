package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.AddressRegion;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface AddressRegionMapper extends BaseMapper<AddressRegion> {

    List<AddressRegion> selectByParentCode(String parentCode);

    List<AddressRegion> selectByLevel(Integer level);

    AddressRegion selectByRegionCode(String regionCode);
}