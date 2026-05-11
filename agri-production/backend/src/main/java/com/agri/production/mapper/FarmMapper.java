package com.agri.production.mapper;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.entity.Farm;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface FarmMapper extends BaseMapper<Farm> {

    IPage<Farm> pageQuery(Page<Farm> page, @Param("dto") FarmPageDTO dto, @Param("tenantId") String tenantId);

    Farm selectByCode(@Param("farmCode") String farmCode, @Param("tenantId") String tenantId);
}