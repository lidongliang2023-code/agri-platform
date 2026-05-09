package com.agri.production.mapper;

import com.agri.production.entity.Farm;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FarmMapper extends BaseMapper<Farm> {

    @Select("SELECT * FROM agri_prod_farm WHERE del_flag = 0 AND status = 'active' ORDER BY create_time DESC")
    List<Farm> selectActiveFarms();

    @Select("SELECT * FROM agri_prod_farm WHERE del_flag = 0 AND farm_type = #{farmType} ORDER BY create_time DESC")
    List<Farm> selectByFarmType(@Param("farmType") String farmType);

    @Select("SELECT * FROM agri_prod_farm WHERE del_flag = 0 AND audit_status = #{auditStatus} ORDER BY create_time DESC")
    List<Farm> selectByAuditStatus(@Param("auditStatus") String auditStatus);

    @Select("SELECT * FROM agri_prod_farm WHERE del_flag = 0 AND tenant_id = #{tenantId} ORDER BY create_time DESC")
    List<Farm> selectByTenantId(@Param("tenantId") String tenantId);
}