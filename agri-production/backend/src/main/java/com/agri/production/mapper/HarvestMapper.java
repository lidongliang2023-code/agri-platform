package com.agri.production.mapper;

import com.agri.production.entity.Harvest;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface HarvestMapper extends BaseMapper<Harvest> {

    @Select("SELECT * FROM agri_prod_harvest WHERE del_flag = 0 AND farm_id = #{farmId} ORDER BY harvest_date DESC")
    List<Harvest> selectByFarmId(@Param("farmId") Long farmId);

    @Select("SELECT * FROM agri_prod_harvest WHERE del_flag = 0 AND plot_id = #{plotId} ORDER BY harvest_date DESC")
    List<Harvest> selectByPlotId(@Param("plotId") Long plotId);

    @Select("SELECT * FROM agri_prod_harvest WHERE del_flag = 0 AND status = #{status} ORDER BY harvest_date DESC")
    List<Harvest> selectByStatus(@Param("status") String status);
}