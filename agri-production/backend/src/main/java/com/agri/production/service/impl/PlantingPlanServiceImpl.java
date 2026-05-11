package com.agri.production.service.impl;

import com.agri.production.entity.PlantingPlan;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.service.IPlantingPlanService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
public class PlantingPlanServiceImpl extends ServiceImpl<PlantingPlanMapper, PlantingPlan> implements IPlantingPlanService {

    @Override
    public IPage<PlantingPlan> queryPage(Page<PlantingPlan> page, Long farmId, String planName, Integer planYear, String planStatus) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0);
        
        if (farmId != null) {
            wrapper.eq(PlantingPlan::getFarmId, farmId);
        }
        if (planName != null && !planName.isEmpty()) {
            wrapper.like(PlantingPlan::getPlanName, planName);
        }
        if (planYear != null) {
            wrapper.eq(PlantingPlan::getPlanYear, planYear);
        }
        if (planStatus != null && !planStatus.isEmpty()) {
            wrapper.eq(PlantingPlan::getPlanStatus, planStatus);
        }
        
        wrapper.orderByDesc(PlantingPlan::getCreateTime);
        return this.page(page, wrapper);
    }

    @Override
    public List<PlantingPlan> getPlansByFarmId(Long farmId) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0)
               .eq(PlantingPlan::getFarmId, farmId)
               .orderByDesc(PlantingPlan::getPlanYear)
               .orderByDesc(PlantingPlan::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<PlantingPlan> getPlansByYear(Integer planYear) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0)
               .eq(PlantingPlan::getPlanYear, planYear)
               .orderByDesc(PlantingPlan::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<PlantingPlan> getPlansByStatus(String planStatus) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0)
               .eq(PlantingPlan::getPlanStatus, planStatus)
               .orderByDesc(PlantingPlan::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean approvePlan(Long id, String approver, String comment) {
        PlantingPlan plan = this.getById(id);
        if (plan == null || plan.getDeleted() == 1) {
            return false;
        }
        plan.setPlanStatus("approved");
        plan.setApprover(approver);
        plan.setApprovalComment(comment);
        plan.setUpdateTime(LocalDateTime.now());
        return this.updateById(plan);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean submitPlan(Long id) {
        PlantingPlan plan = this.getById(id);
        if (plan == null || plan.getDeleted() == 1) {
            return false;
        }
        plan.setPlanStatus("submitted");
        plan.setUpdateTime(LocalDateTime.now());
        return this.updateById(plan);
    }
}