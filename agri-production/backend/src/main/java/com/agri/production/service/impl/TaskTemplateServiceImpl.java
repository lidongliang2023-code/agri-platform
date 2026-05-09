package com.agri.production.service.impl;

import com.agri.production.entity.TaskTemplate;
import com.agri.production.mapper.TaskTemplateMapper;
import com.agri.production.service.ITaskTemplateService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
@Slf4j
public class TaskTemplateServiceImpl extends ServiceImpl<TaskTemplateMapper, TaskTemplate> implements ITaskTemplateService {

    @Override
    public IPage<TaskTemplate> queryPage(Page<TaskTemplate> page, String templateName, String templateType, String cropCategory, String taskType) {
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0);
        
        if (templateName != null && !templateName.isEmpty()) {
            wrapper.like(TaskTemplate::getTemplateName, templateName);
        }
        if (templateType != null && !templateType.isEmpty()) {
            wrapper.eq(TaskTemplate::getTemplateType, templateType);
        }
        if (cropCategory != null && !cropCategory.isEmpty()) {
            wrapper.eq(TaskTemplate::getCropCategory, cropCategory);
        }
        if (taskType != null && !taskType.isEmpty()) {
            wrapper.eq(TaskTemplate::getTaskType, taskType);
        }
        
        wrapper.orderByDesc(TaskTemplate::getSortOrder)
               .orderByDesc(TaskTemplate::getCreateTime);
        return this.page(page, wrapper);
    }

    @Override
    public List<TaskTemplate> getTemplatesByType(String templateType) {
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0)
               .eq(TaskTemplate::getTemplateType, templateType)
               .orderByDesc(TaskTemplate::getSortOrder)
               .orderByDesc(TaskTemplate::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<TaskTemplate> getTemplatesByCrop(String cropCategory) {
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0)
               .eq(TaskTemplate::getCropCategory, cropCategory)
               .orderByDesc(TaskTemplate::getSortOrder)
               .orderByDesc(TaskTemplate::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<TaskTemplate> getTemplatesByTaskType(String taskType) {
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0)
               .eq(TaskTemplate::getTaskType, taskType)
               .orderByDesc(TaskTemplate::getSortOrder)
               .orderByDesc(TaskTemplate::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<TaskTemplate> getSystemTemplates() {
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0)
               .eq(TaskTemplate::getIsSystem, 1)
               .eq(TaskTemplate::getStatus, "active")
               .orderByDesc(TaskTemplate::getSortOrder);
        return this.list(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateTemplateStatus(Long id, String status) {
        TaskTemplate template = this.getById(id);
        if (template == null || template.getDelFlag() == 1) {
            return false;
        }
        template.setStatus(status);
        template.setUpdateTime(new Date());
        return this.updateById(template);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void incrementUseCount(Long id) {
        TaskTemplate template = this.getById(id);
        if (template != null && template.getDelFlag() == 0) {
            template.setUseCount(template.getUseCount() + 1);
            template.setUpdateTime(new Date());
            this.updateById(template);
        }
    }
}