package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.TenantQuota;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TenantQuotaMapper extends BaseMapper<TenantQuota> {

    List<TenantQuota> selectByTenantId(@Param("tenantId") String tenantId);

    TenantQuota selectByTenantIdAndType(@Param("tenantId") String tenantId, @Param("quotaType") String quotaType);
}