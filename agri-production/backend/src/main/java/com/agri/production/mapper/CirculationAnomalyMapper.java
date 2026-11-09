package com.agri.production.mapper;

import com.agri.production.entity.CirculationAnomaly;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CirculationAnomalyMapper extends BaseMapper<CirculationAnomaly> {
    @org.apache.ibatis.annotations.Select("SELECT * FROM agri_prod_fs_circulation_anomaly WHERE anomaly_id = #{id} AND deleted = 0 FOR UPDATE")
    CirculationAnomaly lockById(@org.apache.ibatis.annotations.Param("id") String id);
}
