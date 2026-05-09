package com.agri.production.service;

import com.agri.production.entity.PlantingPlan;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IPlantingPlanService extends IService<PlantingPlan> {

    IPage<PlantingPlan> queryPage(Page<PlantingPlan> page, Long farmId, String planName, Integer planYear, String planStatus);

    List<PlantingPlan> getPlansByFarmId(Long farmId);

    List<PlantingPlan> getPlansByYear(Integer planYear);

    List<PlantingPlan> getPlansByStatus(String planStatus);

    boolean approvePlan(Long id, String approver, String comment);

    boolean submitPlan(Long id);
}