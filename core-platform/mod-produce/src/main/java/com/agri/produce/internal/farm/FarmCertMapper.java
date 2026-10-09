package com.agri.produce.internal.farm;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 农场认证（绿色/有机/无公害等） 数据访问。
 */
@Mapper
public interface FarmCertMapper extends BaseMapper<FarmCertEntity> {
}
