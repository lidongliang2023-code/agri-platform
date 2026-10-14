package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.TaskTemplate;
import com.agri.production.service.ITaskTemplateService;
import com.agri.production.vo.TaskTemplateVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 任务模板库。
 *
 * <p>路径按**前端契约**定（前端 {@code api/tasks.ts} 用 {@code BASE=/tasks} 拼
 * {@code /api/v1/production/tasks/templates...}），原先这里挂在
 * {@code /api/production/template} 上 —— 少一层 {@code /v1}、又是另一段前缀，
 * 前端一调就是 404。全前端搜过，没有任何地方用旧路径，所以直接改，不并存两套。</p>
 */
@RestController
@RequestMapping("/api/v1/production/tasks/templates")
@RequiredArgsConstructor
public class TaskTemplateController {

    private final ITaskTemplateService taskTemplateService;

    /** 出参统一走 TaskTemplateVO（字段名对齐前端契约，见该类的说明）。 */
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
            // 前端分页入参用的是 page/size（见 api/tasks.ts 的 fetchTaskTemplatesPage），
            // 后端原先只认 pageNum/pageSize —— 参数名对不上会被 Spring 静默忽略，
            // 表现是"翻页没反应、永远第一页"。两个名字都收。
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        int current = page != null ? page : pageNum;
        int pageSize2 = size != null ? size : pageSize;
        Page<TaskTemplate> page2 = new Page<>(current, pageSize2);
        String nameFilter = (templateName != null && !templateName.isEmpty()) ? templateName : keyword;
        IPage<TaskTemplate> result = taskTemplateService.queryPage(page2, nameFilter, templateType, cropCategory, taskType);
        return ApiResponse.success(toVoPage(result));
    }

    /** 分页（前端契约路径：GET /api/v1/production/tasks/templates） */
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

    /** 按作物取模板（前端 TaskCreate 的模板选择用：GET /templates/by-crop?cropId=） */
    @GetMapping("/by-crop")
    public ApiResponse<List<TaskTemplateVO>> getByCrop(@RequestParam(required = false) String cropId,
                                                       @RequestParam(required = false) String cropName) {
        List<TaskTemplate> templates = taskTemplateService.getTemplatesByCrop(
                cropName != null && !cropName.isEmpty() ? cropName : cropId);
        return ApiResponse.success(toVoList(templates));
    }

    /*
     * 说明：上面新增的两个端点是为了对上前端契约；既有的 /page /list /system /{id}
     * 以及 POST/PUT/DELETE/{id}/status/{id}/use 全部保留（同名前缀变化后一起生效）。
     * status 参数暂时只接不筛 —— 表里 status 是 'active' 这类字符串，等页面确实要用
     * 再按词表实现，避免现在编一套过滤口径出来。
     */
    
    @GetMapping("/list")
    public ApiResponse<List<TaskTemplate>> getList(
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String cropCategory,
            @RequestParam(required = false) String taskType) {
        List<TaskTemplate> templates;
        if (templateType != null && !templateType.isEmpty()) {
            templates = taskTemplateService.getTemplatesByType(templateType);
        } else if (cropCategory != null && !cropCategory.isEmpty()) {
            templates = taskTemplateService.getTemplatesByCrop(cropCategory);
        } else if (taskType != null && !taskType.isEmpty()) {
            templates = taskTemplateService.getTemplatesByTaskType(taskType);
        } else {
            templates = taskTemplateService.list();
        }
        return ApiResponse.success(templates);
    }

    @GetMapping("/system")
    public ApiResponse<List<TaskTemplate>> getSystemTemplates() {
        List<TaskTemplate> templates = taskTemplateService.getSystemTemplates();
        return ApiResponse.success(templates);
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskTemplate> getById(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null) {
            return ApiResponse.error("任务模板不存在");
        }
        return ApiResponse.success(template);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody TaskTemplate template) {
        template.setDelFlag(0);
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());
        template.setStatus("active");
        template.setIsSystem(0);
        boolean success = taskTemplateService.save(template);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody TaskTemplate template) {
        TaskTemplate existing = taskTemplateService.getById(id);
        if (existing == null) {
            return ApiResponse.error("任务模板不存在");
        }
        template.setId(id);
        template.setUpdateTime(new Date());
        boolean success = taskTemplateService.updateById(template);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null) {
            return ApiResponse.error("任务模板不存在");
        }
        template.setDelFlag(1);
        template.setUpdateTime(new Date());
        boolean success = taskTemplateService.updateById(template);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        boolean success = taskTemplateService.updateTemplateStatus(id, status);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新状态失败");
    }

    @PostMapping("/{id}/use")
    public ApiResponse<Boolean> incrementUseCount(@PathVariable Long id) {
        taskTemplateService.incrementUseCount(id);
        return ApiResponse.success(true);
    }
}
