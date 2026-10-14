package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.TaskTemplate;
import com.agri.production.service.ITaskTemplateService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.TaskTemplateVO;
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
            // 业务上的"找不到"要返 4xx：原先走 ApiResponse.error(...) → 业务码 500，
            // 前端显示的是"系统异常"，日志里也是一条与真实故障混淆的 ERROR
            throw new BusinessException(404, "任务模板不存在：" + id);
        }
        return ApiResponse.success(template);
    }

    /**
     * 新增任务模板。
     *
     * <p>原先这里有三处会直接打成 500：① 不校验名称；② 不生成 {@code templateCode}，
     * 而表上那一列是 NOT NULL 无默认值（实测 "Field 'template_code' doesn't have a default value"）；
     * ③ 不写 tenantId（同样是 NOT NULL）。空请求体一提交就是"系统异常"。</p>
     *
     * <p>返回值按契约给**新模板 ID**（前端 {@code createTaskTemplate} 声明的是 {@code Promise<string>}），
     * 原先返回的是 {@code true}，页面拿到的"ID"是个布尔值。</p>
     */
    @PostMapping
    public ApiResponse<String> create(@RequestBody TaskTemplate template) {
        String tenantId = TenantContextService.currentTenantId();
        if (template == null || template.getTemplateName() == null || template.getTemplateName().isBlank()) {
            throw new BusinessException(400, "模板名称不能为空");
        }
        template.setDelFlag(0);
        template.setTenantId(tenantId);
        template.setTemplateName(template.getTemplateName().trim());
        if (template.getTemplateCode() == null || template.getTemplateCode().isBlank()) {
            template.setTemplateCode(nextTemplateCode(tenantId));
        }
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());
        template.setStatus("active");
        template.setIsSystem(0);
        try {
            taskTemplateService.save(template);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(400, "模板编码已存在：" + template.getTemplateCode());
        }
        return ApiResponse.success(String.valueOf(template.getId()));
    }

    /**
     * 更新任务模板。
     *
     * <p>原先是 {@code template.setId(id); updateById(template)} —— 请求体里没下发的列会被**清成 null**
     * （页面编辑只改其中几项，一提交就把其它字段抹掉）。这里改成在已加载的实体上就地改。</p>
     */
    @PutMapping("/{id}")
    public ApiResponse<TaskTemplate> update(@PathVariable Long id, @RequestBody TaskTemplate template) {
        TaskTemplate existing = taskTemplateService.getById(id);
        if (existing == null) {
            throw new BusinessException(404, "任务模板不存在：" + id);
        }
        if (template == null) {
            throw new BusinessException(400, "模板内容不能为空");
        }
        if (template.getTemplateName() != null && !template.getTemplateName().isBlank()) {
            existing.setTemplateName(template.getTemplateName().trim());
        }
        if (template.getTemplateCode() != null && !template.getTemplateCode().isBlank()) {
            existing.setTemplateCode(template.getTemplateCode().trim());
        }
        if (template.getTemplateType() != null) {
            existing.setTemplateType(template.getTemplateType());
        }
        if (template.getCropCategory() != null) {
            existing.setCropCategory(template.getCropCategory());
        }
        if (template.getCropName() != null) {
            existing.setCropName(template.getCropName());
        }
        if (template.getTaskType() != null) {
            existing.setTaskType(template.getTaskType());
        }
        if (template.getGrowthStage() != null) {
            existing.setGrowthStage(template.getGrowthStage());
        }
        if (template.getDescription() != null) {
            existing.setDescription(template.getDescription());
        }
        if (template.getTemplateContent() != null) {
            existing.setTemplateContent(template.getTemplateContent());
        }
        if (template.getRecommendedDurationHours() != null) {
            existing.setRecommendedDurationHours(template.getRecommendedDurationHours());
        }
        if (template.getRequiredInputs() != null) {
            existing.setRequiredInputs(template.getRequiredInputs());
        }
        if (template.getOptionalInputs() != null) {
            existing.setOptionalInputs(template.getOptionalInputs());
        }
        if (template.getSortOrder() != null) {
            existing.setSortOrder(template.getSortOrder());
        }
        if (template.getStatus() != null && !template.getStatus().isBlank()) {
            existing.setStatus(template.getStatus());
        }
        if (template.getRemark() != null) {
            existing.setRemark(template.getRemark());
        }
        existing.setUpdateTime(new Date());
        taskTemplateService.updateById(existing);
        return ApiResponse.success(existing);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        TaskTemplate template = taskTemplateService.getById(id);
        if (template == null) {
            throw new BusinessException(404, "任务模板不存在：" + id);
        }
        template.setDelFlag(1);
        template.setUpdateTime(new Date());
        taskTemplateService.updateById(template);
        return ApiResponse.success(true);
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        if (status == null || status.isBlank()) {
            throw new BusinessException(400, "status 不能为空");
        }
        boolean success = taskTemplateService.updateTemplateStatus(id, status);
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

    /** 生成同租户内唯一的模板编码：TPL-yyyyMMdd-4 位随机。 */
    private String nextTemplateCode(String tenantId) {
        String day = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        for (int i = 0; i < 8; i++) {
            String code = "TPL-" + day + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = taskTemplateService.lambdaQuery().eq(TaskTemplate::getTenantId, tenantId)
                    .eq(TaskTemplate::getTemplateCode, code).count();
            if (used == null || used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成模板编码失败，请稍后重试");
    }
}
