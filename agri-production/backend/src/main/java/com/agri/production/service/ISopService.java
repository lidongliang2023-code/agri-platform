package com.agri.production.service;

import com.agri.production.entity.SopExecution;
import com.agri.production.entity.SopTemplate;
import com.agri.production.common.entity.PageResult;

import java.util.List;

public interface ISopService {

    SopTemplate saveTemplate(SopTemplate template, String tenantId);

    void deleteTemplate(Long id);

    SopTemplate getTemplateById(Long id);

    PageResult<?> listTemplates(String templateName, String category, String taskType, Integer pageNum, Integer pageSize, String tenantId);

    void enableTemplate(Long id, boolean enable);

    List<SopTemplate> getTemplatesByTaskType(String taskType, String tenantId);

    SopExecution startExecution(Long templateId, Long taskId, String executor, String tenantId);

    void completeStep(Long executionId, Integer stepIndex, String record, String attachment);

    void completeExecution(Long executionId);

    void cancelExecution(Long executionId);

    SopExecution getExecutionById(Long id);

    PageResult<?> listExecutions(Long templateId, Long taskId, String status, Integer pageNum, Integer pageSize, String tenantId);
}