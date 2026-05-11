package com.agri.production.mapper;

import com.agri.production.dto.InputMaterialPageDTO;
import com.agri.production.entity.InputMaterial;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface InputMaterialMapper extends BaseMapper<InputMaterial> {

    IPage<InputMaterial> pageQuery(Page<InputMaterial> page, @Param("dto") InputMaterialPageDTO dto, @Param("tenantId") String tenantId);

    InputMaterial selectByCode(@Param("materialCode") String materialCode, @Param("tenantId") String tenantId);
}