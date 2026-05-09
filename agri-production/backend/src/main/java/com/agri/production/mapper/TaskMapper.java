package com.agri.production.mapper;

import com.agri.production.entity.Task;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TaskMapper extends BaseMapper<Task> {

    @Select("SELECT * FROM agri_prod_task WHERE del_flag = 0 AND farm_id = #{farmId} ORDER BY plan_date DESC, priority DESC")
    List<Task> selectByFarmId(@Param("farmId") Long farmId);

    @Select("SELECT * FROM agri_prod_task WHERE del_flag = 0 AND status = #{status} ORDER BY plan_date DESC")
    List<Task> selectByStatus(@Param("status") String status);

    @Select("SELECT * FROM agri_prod_task WHERE del_flag = 0 AND task_type = #{taskType} ORDER BY plan_date DESC")
    List<Task> selectByTaskType(@Param("taskType") String taskType);

    @Select("SELECT * FROM agri_prod_task WHERE del_flag = 0 AND plot_id = #{plotId} ORDER BY plan_date DESC")
    List<Task> selectByPlotId(@Param("plotId") Long plotId);

    @Select("SELECT * FROM agri_prod_task WHERE del_flag = 0 AND plan_executor = #{executor} ORDER BY plan_date DESC")
    List<Task> selectByExecutor(@Param("executor") String executor);
}