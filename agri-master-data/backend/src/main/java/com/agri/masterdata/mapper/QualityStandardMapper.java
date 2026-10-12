package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.QualityStandard;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface QualityStandardMapper extends BaseMapper<QualityStandard> {

    List<QualityStandard> selectByCategoryId(@Param("categoryId") Long categoryId);

    List<QualityStandard> selectByStandardCode(@Param("standardCode") String standardCode);

    List<QualityStandard> selectByAttributeCode(@Param("attributeCode") String attributeCode);
}