package com.agri.production.mapper;

import com.agri.production.entity.ProductionReport;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 生产报表 mapper（单表条件查询，条件构造器足够，不另写 XML）。 */
@Mapper
public interface ProductionReportMapper extends BaseMapper<ProductionReport> {
}
