package com.agri.production.service.impl;

import com.agri.production.entity.Task;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.ITaskService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Service
public class TaskServiceImpl extends ServiceImpl<TaskMapper, Task> implements ITaskService {

    @Override
    public IPage<Task> queryPage(Page<Task> page, Long farmId, String taskName, String taskType, String status, String executor) {
        QueryWrapper<Task> wrapper = new QueryWrapper<>();
        wrapper.eq("del_flag", 0);
        if (farmId != null) {
            wrapper.eq("farm_id", farmId);
        }
        if (taskName != null && !taskName.isEmpty()) {
            wrapper.like("task_name", taskName);
        }
        if (taskType != null && !taskType.isEmpty()) {
            wrapper.eq("task_type", taskType);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (executor != null && !executor.isEmpty()) {
            wrapper.eq("plan_executor", executor);
        }
        wrapper.orderByDesc("plan_date").orderByDesc("priority");
        return page(page, wrapper);
    }

    @Override
    public List<Task> getTasksByFarmId(Long farmId) {
        return baseMapper.selectByFarmId(farmId);
    }

    @Override
    public List<Task> getTasksByStatus(String status) {
        return baseMapper.selectByStatus(status);
    }

    @Override
    public List<Task> getTasksByType(String taskType) {
        return baseMapper.selectByTaskType(taskType);
    }

    @Override
    public List<Task> getTasksByPlotId(Long plotId) {
        return baseMapper.selectByPlotId(plotId);
    }

    @Override
    @Transactional
    public boolean updateTaskStatus(Long id, String status) {
        Task task = getById(id);
        if (task != null) {
            task.setStatus(status);
            task.setUpdateTime(new Date());
            if ("completed".equals(status)) {
                task.setCompletionRate(new BigDecimal("100"));
                task.setActualEndTime(new Date());
            } else if ("executing".equals(status) && task.getActualStartTime() == null) {
                task.setActualStartTime(new Date());
            }
            return updateById(task);
        }
        return false;
    }

    @Override
    @Transactional
    public boolean updateTaskProgress(Long id, Double completionRate) {
        Task task = getById(id);
        if (task != null) {
            task.setCompletionRate(new BigDecimal(completionRate));
            task.setUpdateTime(new Date());
            return updateById(task);
        }
        return false;
    }
}