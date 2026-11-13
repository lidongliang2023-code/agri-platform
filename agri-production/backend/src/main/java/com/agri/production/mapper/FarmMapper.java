package com.agri.production.mapper;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.entity.Farm;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface FarmMapper extends BaseMapper<Farm> {

    IPage<Farm> pageQuery(Page<Farm> page, @Param("dto") FarmPageDTO dto, @Param("tenantId") String tenantId);

    /** 与地块保存串行化；调用方必须处于事务中。 */
    @org.apache.ibatis.annotations.Select("SELECT id FROM agri_prod_farm_info WHERE id = #{id} AND deleted = 0 FOR UPDATE")
    Long lockBoundary(@Param("id") Long id);

    @org.apache.ibatis.annotations.Select("SELECT * FROM agri_prod_farm_info WHERE id = #{id} AND deleted = 0 FOR UPDATE")
    Farm boundaryForUpdate(@Param("id") Long id);

    Farm selectByCode(@Param("farmCode") String farmCode, @Param("tenantId") String tenantId);
}