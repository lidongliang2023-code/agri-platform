package com.agri.production.mapper;

import com.agri.production.dto.HarvestPageDTO;
import com.agri.production.entity.Harvest;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface HarvestMapper extends BaseMapper<Harvest> {

    IPage<Harvest> pageQuery(Page<Harvest> page, @Param("dto") HarvestPageDTO dto, @Param("tenantId") String tenantId);

    List<Harvest> selectByFarmId(@Param("farmId") Long farmId, @Param("tenantId") String tenantId);

    Harvest selectByCode(@Param("harvestCode") String harvestCode, @Param("tenantId") String tenantId);
}