package com.agri.production.mapper;

import com.agri.production.entity.Inspection;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface InspectionMapper extends BaseMapper<Inspection> {
    @org.apache.ibatis.annotations.Select("SELECT id AS inspection_id, agri_prod_inspection.* FROM agri_prod_inspection WHERE id = #{id} AND tenant_id = #{tenantId} AND deleted = 0 FOR UPDATE")
    Inspection selectOwnedForUpdate(@org.apache.ibatis.annotations.Param("id") Long id, @org.apache.ibatis.annotations.Param("tenantId") String tenantId);

}
