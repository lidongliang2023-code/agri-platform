package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Tenant;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TenantMapper extends BaseMapper<Tenant> {

    Tenant selectByTenantCode(@Param("tenantCode") String tenantCode);
}