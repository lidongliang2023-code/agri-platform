package com.agri.production.mapper;

import com.agri.production.entity.EmergencyPlan;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface EmergencyPlanMapper extends BaseMapper<EmergencyPlan> {

    List<EmergencyPlan> selectByAlertLevel(@Param("alertLevel") String alertLevel, @Param("tenantId") String tenantId);

    EmergencyPlan selectByCode(@Param("planCode") String planCode, @Param("tenantId") String tenantId);
}