package com.agri.production.service;

import com.agri.production.entity.Task;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ITaskService extends IService<Task> {

    IPage<Task> queryPage(Page<Task> page, Long farmId, String taskName, String taskType, String status, String executor);

    List<Task> getTasksByFarmId(Long farmId);

    List<Task> getTasksByStatus(String status);

    List<Task> getTasksByType(String taskType);

    List<Task> getTasksByPlotId(Long plotId);

    boolean updateTaskStatus(Long id, String status);

    boolean updateTaskProgress(Long id, Double completionRate);
}