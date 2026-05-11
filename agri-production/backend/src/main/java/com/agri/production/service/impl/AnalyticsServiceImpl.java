package com.agri.production.service.impl;

import com.agri.production.entity.Farm;
import com.agri.production.entity.Harvest;
import com.agri.production.entity.InputMaterial;
import com.agri.production.entity.Task;
import com.agri.production.service.IAnalyticsService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnalyticsServiceImpl implements IAnalyticsService {

    private final com.agri.production.mapper.FarmMapper farmMapper;
    private final com.agri.production.mapper.TaskMapper taskMapper;
    private final com.agri.production.mapper.HarvestMapper harvestMapper;
    private final com.agri.production.mapper.InputMaterialMapper inputMaterialMapper;

    public AnalyticsServiceImpl(
            com.agri.production.mapper.FarmMapper farmMapper,
            com.agri.production.mapper.TaskMapper taskMapper,
            com.agri.production.mapper.HarvestMapper harvestMapper,
            com.agri.production.mapper.InputMaterialMapper inputMaterialMapper) {
        this.farmMapper = farmMapper;
        this.taskMapper = taskMapper;
        this.harvestMapper = harvestMapper;
        this.inputMaterialMapper = inputMaterialMapper;
    }

    @Override
    public Map<String, Object> getProductionOverview(String tenantId) {
        Map<String, Object> result = new HashMap<>();

        LambdaQueryWrapper<Farm> farmWrapper = new LambdaQueryWrapper<>();
        farmWrapper.eq(Farm::getTenantId, tenantId).eq(Farm::getDeleted, 0);
        long farmCount = farmMapper.selectCount(farmWrapper);

        LambdaQueryWrapper<Task> taskWrapper = new LambdaQueryWrapper<>();
        taskWrapper.eq(Task::getTenantId, tenantId).eq(Task::getDeleted, 0);
        long totalTasks = taskMapper.selectCount(taskWrapper);
        
        taskWrapper.eq(Task::getStatus, "completed");
        long completedTasks = taskMapper.selectCount(taskWrapper);

        LambdaQueryWrapper<Harvest> harvestWrapper = new LambdaQueryWrapper<>();
        harvestWrapper.eq(Harvest::getTenantId, tenantId).eq(Harvest::getDeleted, 0);
        long harvestCount = harvestMapper.selectCount(harvestWrapper);

        LambdaQueryWrapper<InputMaterial> inputWrapper = new LambdaQueryWrapper<>();
        inputWrapper.eq(InputMaterial::getTenantId, tenantId).eq(InputMaterial::getDeleted, 0);
        long inputCount = inputMaterialMapper.selectCount(inputWrapper);

        result.put("farmCount", farmCount);
        result.put("totalTasks", totalTasks);
        result.put("completedTasks", completedTasks);
        result.put("harvestCount", harvestCount);
        result.put("inputCount", inputCount);
        result.put("taskCompletionRate", totalTasks > 0 ? (completedTasks * 100.0 / totalTasks) : 0);

        return result;
    }

    @Override
    public Map<String, Object> getTaskStatistics(String tenantId) {
        Map<String, Object> result = new HashMap<>();

        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Task::getTenantId, tenantId).eq(Task::getDeleted, 0);
        
        wrapper.eq(Task::getStatus, "pending");
        long pendingCount = taskMapper.selectCount(wrapper);
        
        wrapper.clear();
        wrapper.eq(Task::getTenantId, tenantId).eq(Task::getDeleted, 0).eq(Task::getStatus, "executing");
        long executingCount = taskMapper.selectCount(wrapper);
        
        wrapper.clear();
        wrapper.eq(Task::getTenantId, tenantId).eq(Task::getDeleted, 0).eq(Task::getStatus, "completed");
        long completedCount = taskMapper.selectCount(wrapper);

        result.put("pending", pendingCount);
        result.put("executing", executingCount);
        result.put("completed", completedCount);
        result.put("total", pendingCount + executingCount + completedCount);

        return result;
    }

    @Override
    public Map<String, Object> getHarvestStatistics(String tenantId) {
        Map<String, Object> result = new HashMap<>();

        LambdaQueryWrapper<Harvest> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Harvest::getTenantId, tenantId).eq(Harvest::getDeleted, 0);
        List<Harvest> harvests = harvestMapper.selectList(wrapper);

        BigDecimal totalQuantity = BigDecimal.ZERO;
        long aGradeCount = 0;
        long bGradeCount = 0;
        long cGradeCount = 0;

        for (Harvest harvest : harvests) {
            if (harvest.getActualQuantity() != null) {
                totalQuantity = totalQuantity.add(harvest.getActualQuantity());
            }
            if ("A".equals(harvest.getQualityGrade())) aGradeCount++;
            else if ("B".equals(harvest.getQualityGrade())) bGradeCount++;
            else if ("C".equals(harvest.getQualityGrade())) cGradeCount++;
        }

        result.put("totalQuantity", totalQuantity);
        result.put("harvestCount", harvests.size());
        result.put("gradeA", aGradeCount);
        result.put("gradeB", bGradeCount);
        result.put("gradeC", cGradeCount);

        return result;
    }

    @Override
    public Map<String, Object> getInputMaterialStatistics(String tenantId) {
        Map<String, Object> result = new HashMap<>();

        LambdaQueryWrapper<InputMaterial> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(InputMaterial::getTenantId, tenantId).eq(InputMaterial::getDeleted, 0);
        List<InputMaterial> materials = inputMaterialMapper.selectList(wrapper);

        BigDecimal totalStock = BigDecimal.ZERO;
        long lowStockCount = 0;

        for (InputMaterial material : materials) {
            if (material.getCurrentStock() != null) {
                totalStock = totalStock.add(material.getCurrentStock());
            }
            if (material.getMinStock() != null && material.getCurrentStock() != null) {
                if (material.getCurrentStock().compareTo(material.getMinStock()) < 0) {
                    lowStockCount++;
                }
            }
        }

        result.put("totalStock", totalStock);
        result.put("materialCount", materials.size());
        result.put("lowStockCount", lowStockCount);

        return result;
    }

    @Override
    public Map<String, Object> getFarmDashboard(String tenantId, Long farmId) {
        Map<String, Object> result = new HashMap<>();

        Farm farm = farmMapper.selectById(farmId);
        if (farm != null && tenantId.equals(farm.getTenantId())) {
            result.put("farmName", farm.getFarmName());
            result.put("totalArea", farm.getTotalArea());
            result.put("plotCount", farm.getPlotCount());
        }

        LambdaQueryWrapper<Task> taskWrapper = new LambdaQueryWrapper<>();
        taskWrapper.eq(Task::getTenantId, tenantId).eq(Task::getDeleted, 0).eq(Task::getFarmId, farmId);
        long taskCount = taskMapper.selectCount(taskWrapper);

        LambdaQueryWrapper<Harvest> harvestWrapper = new LambdaQueryWrapper<>();
        harvestWrapper.eq(Harvest::getTenantId, tenantId).eq(Harvest::getDeleted, 0).eq(Harvest::getFarmId, farmId);
        long harvestCount = harvestMapper.selectCount(harvestWrapper);

        result.put("taskCount", taskCount);
        result.put("harvestCount", harvestCount);

        return result;
    }
}