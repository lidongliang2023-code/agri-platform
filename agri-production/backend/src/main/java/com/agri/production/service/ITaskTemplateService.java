package com.agri.production.service;

import com.agri.production.entity.TaskTemplate;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ITaskTemplateService extends IService<TaskTemplate> {

    IPage<TaskTemplate> queryPage(Page<TaskTemplate> page, String templateName, String templateType, String cropCategory, String taskType);

    List<TaskTemplate> getTemplatesByType(String templateType);

    List<TaskTemplate> getTemplatesByCrop(String cropCategory);

    List<TaskTemplate> getTemplatesByTaskType(String taskType);

    List<TaskTemplate> getSystemTemplates();

    boolean updateTemplateStatus(Long id, String status);

    void incrementUseCount(Long id);
}