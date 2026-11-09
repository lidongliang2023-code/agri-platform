package com.agri.production.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.TaskTemplate;
import com.agri.production.service.ITaskTemplateService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.TaskTemplateVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 任务模板库（基础数据，运营维护，多主体使用）。
 */
@RestController
@RequestMapping("/api/v1/production/tasks/templates")
@RequiredArgsConstructor
public class TaskTemplateController {

    private final ITaskTemplateService taskTemplateService;

    private IPage<TaskTemplateVO> toVoPage(IPage<TaskTemplate> page) {
        IPage<TaskTemplateVO> voPage = new Page<>(page.getCurrent(), page.getSize(), page.getTotal());
        voPage.setRecords(page.getRecords().stream().map(TaskTemplateVO::of).toList());
        return voPage;
    }

    private List<TaskTemplateVO> toVoList(List<TaskTemplate> list) {
        return list.stream().map(TaskTemplateVO::of).toList();
    }

    @GetMapping("/page")
    public ApiResponse<IPage<TaskTemplateVO>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String templateName,
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String cropCategory,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        int current = page != null ? page : pageNum;
        int pageSize2 = size != null ? size : pageSize;
        Page<TaskTemplate> page2 = new Page<>(current, pageSize2);
        String nameFilter = (templateName != null && !templateName.isEmpty()) ? templateName : keyword;

        String currentTenant = TenantContextService.currentTenantId();
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0);

        // 租户隔离与平台共享：系统模板(isSystem=1)或同租户历史模板可见
        if (currentTenant != null && !currentTenant.isBlank()) {
            wrapper.and(q -> q.eq(TaskTemplate::getIsSystem, 1)
                    .or().eq(TaskTemplate::getTenantId, currentTenant)
                    .or().eq(TaskTemplate::getTenantId, "PLATFORM"));
        }

        if (nameFilter != null && !nameFilter.isEmpty()) {
            wrapper.and(q -> q.like(TaskTemplate::getTemplateName, nameFilter)
                    .or().like(TaskTemplate::getTemplateCode, nameFilter));
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
        if (status != null) {
            String dbStatus = status == 1 ? "active" : "inactive";
            wrapper.eq(TaskTemplate::getStatus, dbStatus);
        }

        wrapper.orderByDesc(TaskTemplate::getSortOrder)
               .orderByDesc(TaskTemplate::getCreateTime);

        IPage<TaskTemplate> result = taskTemplateService.page(page2, wrapper);
        return ApiResponse.success(toVoPage(result));
    }

    @GetMapping
    public ApiResponse<IPage<TaskTemplateVO>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String templateName,
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String cropCategory,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) Integer status) {
        return getPage(pageNum, pageSize, templateName, templateType, cropCategory, taskType,
                page, size, keyword, status);
    }

    @GetMapping("/by-crop")
    public ApiResponse<List<TaskTemplateVO>> getByCrop(@RequestParam(required = false) String cropId,
                                                       @RequestParam(required = false) String cropName) {
        String filter = cropName != null && !cropName.isEmpty() ? cropName : cropId;
        String currentTenant = TenantContextService.currentTenantId();
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0)
               .eq(TaskTemplate::getStatus, "active");
        if (currentTenant != null && !currentTenant.isBlank()) {
            wrapper.and(q -> q.eq(TaskTemplate::getIsSystem, 1)
                    .or().eq(TaskTemplate::getTenantId, currentTenant)
                    .or().eq(TaskTemplate::getTenantId, "PLATFORM"));
        }
        if (filter != null && !filter.isEmpty()) {
            wrapper.and(q -> q.eq(TaskTemplate::getCropCategory, filter)
                    .or().eq(TaskTemplate::getCropName, filter));
        }
        wrapper.orderByDesc(TaskTemplate::getSortOrder).orderByDesc(TaskTemplate::getCreateTime);
        return ApiResponse.success(toVoList(taskTemplateService.list(wrapper)));
    }

    @GetMapping("/list")
    public ApiResponse<List<TaskTemplateVO>> getList(
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String cropCategory,
            @RequestParam(required = false) String taskType) {
        String currentTenant = TenantContextService.currentTenantId();
        LambdaQueryWrapper<TaskTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TaskTemplate::getDelFlag, 0)
               .eq(TaskTemplate::getStatus, "active");
        if (currentTenant != null && !currentTenant.isBlank()) {
            wrapper.and(q -> q.eq(TaskTemplate::getIsSystem, 1)
                    .or().eq(TaskTemplate::getTenantId, currentTenant)
                    .or().eq(TaskTemplate::getTenantId, "PLATFORM"));
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
        wrapper.orderByDesc(TaskTemplate::getSortOrder).orderByDesc(TaskTemplate::getCreateTime);
        return ApiResponse.success(toVoList(taskTemplateService.list(wrapper)));
    }

    @GetMapping("/system")
    public ApiResponse<List<TaskTemplateVO>> getSystemTemplates() {
        return ApiResponse.success(toVoList(taskTemplateService.getSystemTemplates()));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskTemplateVO> getById(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null || template.getDelFlag() == 1) {
            throw new BusinessException(404, "任务模板不存在：" + id);
        }
        return ApiResponse.success(TaskTemplateVO.of(template));
    }

    @OperatorOnly
    @PostMapping
    public ApiResponse<String> create(@RequestBody Map<String, Object> payload) {
        if (payload == null || payload.get("templateName") == null || String.valueOf(payload.get("templateName")).isBlank()) {
            throw new BusinessException(400, "模板名称不能为空");
        }
        String tenantId = TenantContextService.currentTenantId();
        TaskTemplate template = new TaskTemplate();
        template.setDelFlag(0);
        template.setTenantId(tenantId != null && !tenantId.isBlank() ? tenantId : "PLATFORM");
        template.setTemplateName(String.valueOf(payload.get("templateName")).trim());

        String templateCode = payload.get("templateCode") != null ? String.valueOf(payload.get("templateCode")).trim() : "";
        template.setTemplateCode(!templateCode.isEmpty() ? templateCode : nextTemplateCode(template.getTenantId()));

        if (payload.get("templateType") != null) template.setTemplateType(String.valueOf(payload.get("templateType")));
        if (payload.get("cropCategory") != null) template.setCropCategory(String.valueOf(payload.get("cropCategory")));
        if (payload.get("cropName") != null) template.setCropName(String.valueOf(payload.get("cropName")));
        if (payload.get("taskType") != null) template.setTaskType(String.valueOf(payload.get("taskType")));
        if (payload.get("growthStage") != null) template.setGrowthStage(String.valueOf(payload.get("growthStage")));
        if (payload.get("description") != null) template.setDescription(String.valueOf(payload.get("description")));
        
        // 兼容 workContent / content / templateContent
        Object contentObj = payload.get("templateContent");
        if (contentObj == null) contentObj = payload.get("workContent");
        if (contentObj == null) contentObj = payload.get("content");
        if (contentObj != null) template.setTemplateContent(String.valueOf(contentObj));

        // 兼容 standardHours / workHours / recommendedDurationHours
        Object hoursObj = payload.get("recommendedDurationHours");
        if (hoursObj == null) hoursObj = payload.get("standardHours");
        if (hoursObj == null) hoursObj = payload.get("workHours");
        if (hoursObj != null && !String.valueOf(hoursObj).isBlank()) {
            try {
                template.setRecommendedDurationHours((int) Math.round(Double.parseDouble(String.valueOf(hoursObj))));
            } catch (Exception ignored) {}
        }

        // 投入品兼容
        Object inputsObj = payload.get("inputItems");
        if (inputsObj == null) inputsObj = payload.get("inputIds");
        if (inputsObj == null) inputsObj = payload.get("requiredInputs");
        if (inputsObj instanceof List<?> list) {
            template.setRequiredInputs(String.join(",", list.stream().map(String::valueOf).toList()));
        } else if (inputsObj != null) {
            template.setRequiredInputs(String.valueOf(inputsObj));
        }

        Object statusObj = payload.get("status");
        if (statusObj != null) {
            template.setStatus("1".equals(String.valueOf(statusObj)) || "active".equalsIgnoreCase(String.valueOf(statusObj)) ? "active" : "inactive");
        } else {
            template.setStatus("active");
        }

        template.setIsSystem(1); // 运营维护的基础数据标记为系统标准模板
        template.setUseCount(0);
        template.setSortOrder(payload.get("sortOrder") != null ? Integer.parseInt(String.valueOf(payload.get("sortOrder"))) : 0);
        template.setRemark(payload.get("remark") != null ? String.valueOf(payload.get("remark")) : null);
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());

        try {
            taskTemplateService.save(template);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(400, "模板编码已存在：" + template.getTemplateCode());
        }
        return ApiResponse.success(String.valueOf(template.getId()));
    }

    @OperatorOnly
    @PutMapping("/{id}")
    public ApiResponse<TaskTemplateVO> update(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        TaskTemplate existing = taskTemplateService.getById(id);
        if (existing == null || existing.getDelFlag() == 1) {
            throw new BusinessException(404, "任务模板不存在：" + id);
        }
        if (payload == null || payload.isEmpty()) {
            throw new BusinessException(400, "更新内容不能为空");
        }

        if (payload.containsKey("templateName") && payload.get("templateName") != null) {
            String name = String.valueOf(payload.get("templateName")).trim();
            if (name.isEmpty()) throw new BusinessException(400, "模板名称不能为空");
            existing.setTemplateName(name);
        }
        if (payload.containsKey("templateCode") && payload.get("templateCode") != null) {
            existing.setTemplateCode(String.valueOf(payload.get("templateCode")).trim());
        }
        if (payload.containsKey("templateType")) existing.setTemplateType(payload.get("templateType") != null ? String.valueOf(payload.get("templateType")) : null);
        if (payload.containsKey("cropCategory")) existing.setCropCategory(payload.get("cropCategory") != null ? String.valueOf(payload.get("cropCategory")) : null);
        if (payload.containsKey("cropName")) existing.setCropName(payload.get("cropName") != null ? String.valueOf(payload.get("cropName")) : null);
        if (payload.containsKey("taskType")) existing.setTaskType(payload.get("taskType") != null ? String.valueOf(payload.get("taskType")) : null);
        if (payload.containsKey("growthStage")) existing.setGrowthStage(payload.get("growthStage") != null ? String.valueOf(payload.get("growthStage")) : null);
        if (payload.containsKey("description")) existing.setDescription(payload.get("description") != null ? String.valueOf(payload.get("description")) : null);

        if (payload.containsKey("templateContent") || payload.containsKey("workContent") || payload.containsKey("content")) {
            Object contentObj = payload.get("templateContent");
            if (contentObj == null) contentObj = payload.get("workContent");
            if (contentObj == null) contentObj = payload.get("content");
            existing.setTemplateContent(contentObj != null ? String.valueOf(contentObj) : null);
        }

        if (payload.containsKey("recommendedDurationHours") || payload.containsKey("standardHours") || payload.containsKey("workHours")) {
            Object hoursObj = payload.get("recommendedDurationHours");
            if (hoursObj == null) hoursObj = payload.get("standardHours");
            if (hoursObj == null) hoursObj = payload.get("workHours");
            if (hoursObj != null && !String.valueOf(hoursObj).isBlank()) {
                existing.setRecommendedDurationHours((int) Math.round(Double.parseDouble(String.valueOf(hoursObj))));
            } else {
                existing.setRecommendedDurationHours(null);
            }
        }

        if (payload.containsKey("inputItems") || payload.containsKey("inputIds") || payload.containsKey("requiredInputs")) {
            Object inputsObj = payload.get("inputItems");
            if (inputsObj == null) inputsObj = payload.get("inputIds");
            if (inputsObj == null) inputsObj = payload.get("requiredInputs");
            if (inputsObj instanceof List<?> list) {
                existing.setRequiredInputs(String.join(",", list.stream().map(String::valueOf).toList()));
            } else if (inputsObj != null) {
                existing.setRequiredInputs(String.valueOf(inputsObj));
            } else {
                existing.setRequiredInputs(null);
            }
        }

        if (payload.containsKey("status")) {
            Object statusObj = payload.get("status");
            existing.setStatus("1".equals(String.valueOf(statusObj)) || "active".equalsIgnoreCase(String.valueOf(statusObj)) ? "active" : "inactive");
        }

        if (payload.containsKey("sortOrder") && payload.get("sortOrder") != null) {
            existing.setSortOrder(Integer.parseInt(String.valueOf(payload.get("sortOrder"))));
        }
        if (payload.containsKey("remark")) {
            existing.setRemark(payload.get("remark") != null ? String.valueOf(payload.get("remark")) : null);
        }

        existing.setUpdateTime(new Date());
        taskTemplateService.updateById(existing);
        return ApiResponse.success(TaskTemplateVO.of(existing));
    }

    @OperatorOnly
    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null || template.getDelFlag() == 1) {
            throw new BusinessException(404, "任务模板不存在：" + id);
        }
        template.setDelFlag(1);
        template.setUpdateTime(new Date());
        taskTemplateService.updateById(template);
        return ApiResponse.success(true);
    }

    @OperatorOnly
    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, Object> params) {
        Object statusObj = params != null ? params.get("status") : null;
        if (statusObj == null || String.valueOf(statusObj).isBlank()) {
            throw new BusinessException(400, "status 不能为空");
        }
        String statusStr = "1".equals(String.valueOf(statusObj)) || "active".equalsIgnoreCase(String.valueOf(statusObj)) ? "active" : "inactive";
        boolean success = taskTemplateService.updateTemplateStatus(id, statusStr);
        if (success) {
            return ApiResponse.success(true);
        }
        throw new BusinessException(404, "任务模板不存在：" + id);
    }

    @PostMapping("/{id}/use")
    public ApiResponse<Boolean> incrementUseCount(@PathVariable Long id) {
        taskTemplateService.incrementUseCount(id);
        return ApiResponse.success(true);
    }

    private String nextTemplateCode(String tenantId) {
        String day = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        for (int i = 0; i < 8; i++) {
            String code = "TPL-" + day + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = taskTemplateService.lambdaQuery().eq(TaskTemplate::getTemplateCode, code).count();
            if (used == null || used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成模板编码失败，请稍后重试");
    }
}
