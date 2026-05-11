package com.agri.production.service.impl;

import com.agri.production.entity.SopExecution;
import com.agri.production.entity.SopTemplate;
import com.agri.production.common.entity.PageResult;
import com.agri.production.mapper.SopExecutionMapper;
import com.agri.production.mapper.SopTemplateMapper;
import com.agri.production.service.ISopService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SopServiceImpl implements ISopService {

    private final SopTemplateMapper sopTemplateMapper;
    private final SopExecutionMapper sopExecutionMapper;

    public SopServiceImpl(SopTemplateMapper sopTemplateMapper, SopExecutionMapper sopExecutionMapper) {
        this.sopTemplateMapper = sopTemplateMapper;
        this.sopExecutionMapper = sopExecutionMapper;
    }

    @Override
    @Transactional
    public SopTemplate saveTemplate(SopTemplate template, String tenantId) {
        template.setTenantId(tenantId);
        if (template.getId() == null) {
            template.setTemplateCode("SOP" + System.currentTimeMillis());
            template.setVersion(1);
            template.setUsageCount(0);
            template.setCreateTime(LocalDateTime.now());
            sopTemplateMapper.insert(template);
        } else {
            template.setVersion(template.getVersion() + 1);
            template.setUpdateTime(LocalDateTime.now());
            sopTemplateMapper.updateById(template);
        }
        return template;
    }

    @Override
    @Transactional
    public void deleteTemplate(Long id) {
        sopTemplateMapper.deleteById(id);
    }

    @Override
    public SopTemplate getTemplateById(Long id) {
        return sopTemplateMapper.selectById(id);
    }

    @Override
    public PageResult<?> listTemplates(String templateName, String category, String taskType, Integer pageNum, Integer pageSize, String tenantId) {
        Page<SopTemplate> page = new Page<>(pageNum, pageSize);
        IPage<SopTemplate> result = sopTemplateMapper.pageQuery(page, templateName, category, taskType, tenantId);
        return PageResult.of(result.getRecords(), result.getTotal(), pageNum, pageSize);
    }

    @Override
    @Transactional
    public void enableTemplate(Long id, boolean enable) {
        SopTemplate template = sopTemplateMapper.selectById(id);
        if (template != null) {
            template.setIsEnabled(enable ? 1 : 0);
            sopTemplateMapper.updateById(template);
        }
    }

    @Override
    public List<SopTemplate> getTemplatesByTaskType(String taskType, String tenantId) {
        return sopTemplateMapper.selectByTaskType(taskType, tenantId);
    }

    @Override
    @Transactional
    public SopExecution startExecution(Long templateId, Long taskId, String executor, String tenantId) {
        SopTemplate template = sopTemplateMapper.selectById(templateId);
        if (template == null) {
            throw new RuntimeException("SOP模板不存在");
        }

        SopExecution execution = new SopExecution();
        execution.setExecutionCode("EXEC" + System.currentTimeMillis());
        execution.setTemplateId(templateId);
        execution.setTemplateCode(template.getTemplateCode());
        execution.setTemplateName(template.getTemplateName());
        execution.setTaskId(taskId);
        execution.setExecutor(executor);
        execution.setStatus("executing");
        execution.setCurrentStep(1);
        execution.setTotalSteps(10);
        execution.setStartedAt(LocalDateTime.now());
        execution.setTenantId(tenantId);
        sopExecutionMapper.insert(execution);

        template.setUsageCount(template.getUsageCount() + 1);
        sopTemplateMapper.updateById(template);

        return execution;
    }

    @Override
    @Transactional
    public void completeStep(Long executionId, Integer stepIndex, String record, String attachment) {
        SopExecution execution = sopExecutionMapper.selectById(executionId);
        if (execution != null) {
            execution.setCurrentStep(stepIndex + 1);
            sopExecutionMapper.updateById(execution);
        }
    }

    @Override
    @Transactional
    public void completeExecution(Long executionId) {
        SopExecution execution = sopExecutionMapper.selectById(executionId);
        if (execution != null) {
            execution.setStatus("completed");
            execution.setCompletedAt(LocalDateTime.now());
            execution.setCurrentStep(execution.getTotalSteps());
            sopExecutionMapper.updateById(execution);
        }
    }

    @Override
    @Transactional
    public void cancelExecution(Long executionId) {
        SopExecution execution = sopExecutionMapper.selectById(executionId);
        if (execution != null) {
            execution.setStatus("cancelled");
            execution.setCompletedAt(LocalDateTime.now());
            sopExecutionMapper.updateById(execution);
        }
    }

    @Override
    public SopExecution getExecutionById(Long id) {
        return sopExecutionMapper.selectById(id);
    }

    @Override
    public PageResult<?> listExecutions(Long templateId, Long taskId, String status, Integer pageNum, Integer pageSize, String tenantId) {
        Page<SopExecution> page = new Page<>(pageNum, pageSize);
        IPage<SopExecution> result = sopExecutionMapper.pageQuery(page, templateId, taskId, status, tenantId);
        return PageResult.of(result.getRecords(), result.getTotal(), pageNum, pageSize);
    }
}