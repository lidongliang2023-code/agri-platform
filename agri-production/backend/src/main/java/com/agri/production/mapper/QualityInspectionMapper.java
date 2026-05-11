package com.agri.production.mapper;

import com.agri.production.dto.QualityInspectionQueryDTO;
import com.agri.production.entity.QualityInspection;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface QualityInspectionMapper extends BaseMapper<QualityInspection> {

    IPage<QualityInspection> pageQuery(Page<QualityInspection> page, @Param("dto") QualityInspectionQueryDTO dto, @Param("tenantId") String tenantId);

    long countByQualified(@Param("isQualified") Integer isQualified, @Param("tenantId") String tenantId);
}