package com.agri.production.mapper;

import com.agri.production.entity.FoodSafetyAlert;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FoodSafetyAlertMapper extends BaseMapper<FoodSafetyAlert> {
    @org.apache.ibatis.annotations.Select("SELECT * FROM agri_prod_fs_alert WHERE alert_id = #{id} AND deleted = 0 FOR UPDATE")
    FoodSafetyAlert lockById(@org.apache.ibatis.annotations.Param("id") String id);
}
