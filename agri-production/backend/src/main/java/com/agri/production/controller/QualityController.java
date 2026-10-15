package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.dto.InspectionSaveDTO;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.QualityGradeRule;
import com.agri.production.entity.TestingLab;
import com.agri.production.service.IQualityService;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 质量管理：检测单 / 检测机构 / 分级统计（用户端 + 机构维护）。
 *
 * <p>路径与入参按前端契约（{@code api/quality.ts}，BASE = {@code /api/v1/production/quality}）。
 * 这个控制器替换掉原来的 {@code QualityInspectionController}：那个只有 inspections/items/statistics
 * 一套自定形状（inspectionCode / inspectDate / conclusion / auditStatus），
 * 而页面要的是 {@code RawInspection}（inspectionType / status / result / sampleQty / sampleAt /
 * labId / labName）；路径里 {@code /inspections/{id}/items}、{@code /inspections/{id}/result}、
 * {@code /inspections/by-batch}、{@code /labs*}、{@code /grading} 全都不存在。
 * 同一路径下两个控制器会让 {@code GET /quality/inspections} 映射冲突、应用起不来，所以是替换。</p>
 *
 * <p><b>字面量路径先于 {@code /{id}} 匹配</b>：{@code /inspections/by-batch} 是字面量，
 * Spring 会优先命中；否则会被 {@code /inspections/{id}} 接走并因 Long 转换失败报 400
 * （实测旧的实现就是这个现象）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/quality")
public class QualityController {

    private final IQualityService qualityService;
    private final FarmIdResolver farmIdResolver;

    public QualityController(IQualityService qualityService, FarmIdResolver farmIdResolver) {
        this.qualityService = qualityService;
        this.farmIdResolver = farmIdResolver;
    }

    /* ==================== 检测单 ==================== */

    /** 分页查询检测单。 */
    @GetMapping("/inspections")
    public ApiResponse<PageResult<Inspection>> pageInspections(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String inspectionType,
            @RequestParam(required = false) String inspectType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String inspectResult,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String batchId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(qualityService.pageInspections(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                keyword, status,
                // 农场筛选走解析：页面传的是平台侧标识（DEMO-FARM-xxx）；解析不出来就 400，
                // 而不是像原先那样 parseLong 失败 → null → 过滤条件被悄悄丢掉、返回全量
                farmIdResolver.resolveFilter(farmId, tenantId), toLong(batchId),
                inspectionType != null ? inspectionType : inspectType,
                result != null ? result : inspectResult,
                startDate, endDate, tenantId));
    }

    /** 批次下的检测记录（溯源页按批次查）。 */
    @GetMapping("/inspections/by-batch")
    public ApiResponse<List<Inspection>> inspectionsByBatch(@RequestParam(required = false) String batchId) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(qualityService.byBatch(toLong(batchId), tenantId));
    }

    /** 检测单详情。 */
    @GetMapping("/inspections/{id}")
    public ApiResponse<Inspection> inspectionDetail(@PathVariable Long id) {
        return ApiResponse.success(qualityService.detail(id, TenantContextService.currentTenantId()));
    }

    /**
     * 检测项明细。
     *
     * <p>返回契约 {@code InspectionItemDetail} 的形状（头部字段 + items 数组）。</p>
     */
    @GetMapping("/inspections/{id}/items")
    public ApiResponse<Map<String, Object>> inspectionItems(@PathVariable Long id) {
        return ApiResponse.success(qualityService.items(id, TenantContextService.currentTenantId()));
    }

    /** 送检登记：新增检测单，返回新检测单 ID。 */
    @PostMapping("/inspections")
    public ApiResponse<String> createInspection(@RequestBody InspectionSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(qualityService.create(dto, tenantId).getInspectionId()));
    }

    /** 编辑检测单。 */
    @PutMapping("/inspections/{id}")
    public ApiResponse<Inspection> updateInspection(@PathVariable Long id, @RequestBody InspectionSaveDTO dto) {
        return ApiResponse.success(qualityService.update(id, dto, TenantContextService.currentTenantId()));
    }

    /** 删除检测单（逻辑删除）。 */
    @DeleteMapping("/inspections/{id}")
    public ApiResponse<Void> deleteInspection(@PathVariable Long id) {
        qualityService.delete(id, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /**
     * 提交检测结论。
     *
     * <p>入参走查询串（前端 {@code submitInspectionResult(id, result, reportUrl)} 就是 params）——
     * 无请求体的写操作若声明成 {@code @RequestBody} 必填，一调就是
     * "Content-Type ... is not supported" 的 500。</p>
     *
     * <p>注：契约注释提到结论应联动 {@code prod.quality.test.passed/failed} 事件。
     * 本服务目前**没有事件总线**（全模块搜不到 publisher），所以没有伪造这个联动；
     * 已作为缺口记在交付说明里。</p>
     */
    @PostMapping("/inspections/{id}/result")
    public ApiResponse<Inspection> submitResult(@PathVariable Long id,
                                               @RequestParam String result,
                                               @RequestParam(required = false) String reportUrl) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(qualityService.submitResult(id, result, reportUrl, tenantId));
    }

    /* ==================== 检测机构 ==================== */

    /** 分页查询检测机构（用户端送检登记的下拉用它）。 */
    @GetMapping("/labs")
    public ApiResponse<PageResult<TestingLab>> pageLabs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(qualityService.pageLabs(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 100), keyword, status, tenantId));
    }

    /** 合作中的检测机构。 */
    @GetMapping("/labs/active")
    public ApiResponse<List<TestingLab>> activeLabs() {
        return ApiResponse.success(qualityService.activeLabs(TenantContextService.currentTenantId()));
    }

    /** 新增检测机构（运营端维护），返回新机构 ID。 */
    @PostMapping("/labs")
    public ApiResponse<String> createLab(@RequestBody TestingLab lab) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(qualityService.createLab(lab, tenantId).getLabId()));
    }

    /** 更新检测机构（运营端维护）。 */
    @PutMapping("/labs/{labId}")
    public ApiResponse<TestingLab> updateLab(@PathVariable Long labId, @RequestBody TestingLab lab) {
        return ApiResponse.success(qualityService.updateLab(labId, lab, TenantContextService.currentTenantId()));
    }

    /** 删除检测机构（逻辑删除）。 */
    @DeleteMapping("/labs/{labId}")
    public ApiResponse<Void> deleteLab(@PathVariable Long labId) {
        qualityService.deleteLab(labId, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /* ==================== 分级统计 ==================== */

    /**
     * 分级统计 / 分级规则分页 —— 同一个 GET 路径，按"有没有分页或筛选参数"分流。
     *
     * <p>这条路径在 api 层有两个函数，而且都是既定的：</p>
     * <ul>
     *   <li>{@code fetchGradingStats()} —— <b>不带任何参数</b>，期望 {@code {"PASS": n, "FAIL": n}}；</li>
     *   <li>{@code listGradeRules(params)} —— 一定带 {@code pageNum/pageSize}（可选 {@code cropId/status}），
     *       期望 {@code PageResult<QualityGradeRule>}。</li>
     * </ul>
     *
     * <p>没有参数 → 统计；带了分页/筛选参数 → 规则分页。两个调用方的实际下发方式正好互斥，
     * 所以这样分流不会误判任何一个。之所以不另开路径：{@code POST/PUT/DELETE /quality/grading}
     * 在 core-platform 上是既有实现（规则 CRUD），切流之后若把 GET 挪走，规则就没法列表了。</p>
     */
    @GetMapping("/grading")
    public ApiResponse<?> grading(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String cropId,
            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        boolean wantsRules = page != null || pageNum != null || size != null || pageSize != null
                || cropId != null || status != null;
        if (wantsRules) {
            return ApiResponse.success(qualityService.pageGradeRules(
                    firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                    toLong(cropId), status, tenantId));
        }
        return ApiResponse.success(qualityService.gradingStats(tenantId));
    }

    /** 新增分级规则，返回新规则 ID。 */
    @PostMapping("/grading")
    public ApiResponse<String> createGradeRule(@RequestBody QualityGradeRule rule) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(qualityService.createGradeRule(rule, tenantId).getRuleId()));
    }

    /** 更新分级规则。 */
    @PutMapping("/grading/{ruleId}")
    public ApiResponse<QualityGradeRule> updateGradeRule(@PathVariable Long ruleId, @RequestBody QualityGradeRule rule) {
        return ApiResponse.success(qualityService.updateGradeRule(ruleId, rule, TenantContextService.currentTenantId()));
    }

    /** 删除分级规则（逻辑删除）。 */
    @DeleteMapping("/grading/{ruleId}")
    public ApiResponse<Void> deleteGradeRule(@PathVariable Long ruleId) {
        qualityService.deleteGradeRule(ruleId, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /* ==================== 内部工具 ==================== */

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }

    private static Long toLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            // 传了非数字标识（例如批次号）不是错误，只是这个过滤条件用不上
            return null;
        }
    }
}
