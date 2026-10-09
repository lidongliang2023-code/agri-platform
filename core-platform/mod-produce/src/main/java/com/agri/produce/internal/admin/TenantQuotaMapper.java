package com.agri.produce.internal.admin;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 租户配额（SaaS 资源上限与用量） 数据访问。
 */
@Mapper
public interface TenantQuotaMapper extends BaseMapper<TenantQuotaEntity> {
}
